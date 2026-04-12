/**
 * LinkedIn profile scraper — Express server backed by Camoufox.
 * Camoufox is a Firefox fork with C++ fingerprint spoofing.
 * Cookies are extracted from Firefox profile (same engine — no cross-browser mismatch).
 *
 * Usage:
 *   node server.js  (cookies auto-extracted from Firefox, or use linkedin-cookies.json)
 *
 * POST /scrape  { url: "https://www.linkedin.com/in/username" }
 *   → { profileText: "..." }
 *   → 422 { error: "..." } on failure
 */

const express = require('express')
const { firefox } = require('playwright-core')
const { launchOptions } = require('/home/rob/.hermes/hermes-agent/node_modules/camoufox-js/dist/index.js')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PORT = parseInt(process.env.PORT || '3099', 10)
const AUTH_TOKEN = process.env.SCRAPER_TOKEN || ''
const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')

const app = express()
app.use(express.json())

const HEALTH = ['/health', '/linkedin-scraper/health']
const SCRAPE = ['/scrape', '/linkedin-scraper/scrape']

// Refresh cookies from live Firefox profile (WAL-aware)
function refreshCookiesFromFirefox() {
  const script = `
import sqlite3, json, shutil, tempfile, os, sys
src = '/home/rob/snap/firefox/common/.mozilla/firefox/k6glr7dy.default/cookies.sqlite'
if not os.path.exists(src):
    sys.exit(1)
wal, shm = src+'-wal', src+'-shm'
tmpdir = tempfile.mkdtemp()
tmp = os.path.join(tmpdir, 'cookies.sqlite')
shutil.copy2(src, tmp)
if os.path.exists(wal): shutil.copy2(wal, tmp+'-wal')
if os.path.exists(shm): shutil.copy2(shm, tmp+'-shm')
conn = sqlite3.connect(tmp)
conn.execute('PRAGMA wal_checkpoint(FULL)')
conn.commit()
SAMESITE = {0:'None',1:'Lax',2:'Strict'}
cur = conn.execute("SELECT name,value,host,path,expiry,isSecure,isHttpOnly,sameSite FROM moz_cookies WHERE host LIKE '%linkedin%'")
SKIP = {'li_g_recent_logout', '_px3', '_px2', '_pxvid', '_pxff', '__cf_bm'}
def norm_exp(v): return (v // 1000) if v and v > 10**10 else (v if v and v > 0 else -1)
seen = set()
cookies = []
for r in cur.fetchall():
    key = (r[0], r[2])
    if r[0] in SKIP or key in seen: continue
    seen.add(key)
    cookies.append({'name':r[0],'value':r[1],'domain':r[2],'path':r[3],'expires':norm_exp(r[4]),'secure':bool(r[5]),'httpOnly':bool(r[6]),'sameSite':SAMESITE.get(r[7],'None')})
conn.close()
shutil.rmtree(tmpdir)
print(json.dumps(cookies))
`
  try {
    const result = execSync(`python3 -c "${script.replace(/"/g, '\\"')}"`, { timeout: 10000 }).toString().trim()
    const cookies = JSON.parse(result)
    const hasAuth = cookies.some(c => c.name === 'li_at')
    if (hasAuth) {
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2))
      return cookies
    }
  } catch { /* fall through to file */ }
  return null
}

app.get(HEALTH, (_req, res) => {
  const hasCookies = fs.existsSync(COOKIES_FILE)
  res.json({ ok: true, cookiesReady: hasCookies, engine: 'camoufox' })
})

app.use((req, res, next) => {
  if (!AUTH_TOKEN) return next()
  const header = req.headers['authorization'] || ''
  if (header !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.post(SCRAPE, async (req, res) => {
  const { url } = req.body || {}

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  let parsed
  try { parsed = new URL(url) } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  if (!parsed.hostname.endsWith('linkedin.com')) {
    return res.status(400).json({ error: 'Only LinkedIn URLs are supported' })
  }

  // Try to refresh cookies from live Firefox first
  let cookies = refreshCookiesFromFirefox()

  // Fall back to saved file
  if (!cookies) {
    if (!fs.existsSync(COOKIES_FILE)) {
      return res.status(503).json({ error: 'No LinkedIn session found. Log into LinkedIn in Firefox first.' })
    }
    try {
      cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'))
    } catch {
      return res.status(503).json({ error: 'Could not read LinkedIn session cookies.' })
    }
  }

  if (!cookies.some(c => c.name === 'li_at')) {
    return res.status(401).json({ error: 'LinkedIn session expired. Log into LinkedIn in Firefox again.' })
  }

  console.log(`[scrape] ${url}`)

  let browser
  try {
    const opts = await launchOptions({ headless: true })
    browser = await firefox.launch(opts)

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load', timeout: 45000 })

    // Check for auth redirect — LinkedIn shows various forms of login page
    const currentUrl = page.url()
    const title = await page.title()
    const bodyText = await page.evaluate(() => (document.body?.innerText || '').slice(0, 500).toLowerCase())
    if (currentUrl.includes('authwall') || currentUrl.includes('/login') ||
        title.toLowerCase().includes('sign in') || title.toLowerCase().includes('log in') ||
        bodyText.includes('join linkedin') || bodyText.includes('sign in') ||
        bodyText.includes('forgot password')) {
      await browser.close()
      return res.status(401).json({
        error: 'LinkedIn session expired. Log into LinkedIn in Firefox again.',
      })
    }

    // Wait for initial React render
    await page.waitForTimeout(2000)

    // Scroll slowly to trigger lazy-loaded Experience/Education sections
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const steps = Math.ceil(pageHeight / 400)
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(pos => window.scrollTo(0, pos), i * 400)
      await page.waitForTimeout(300)
    }

    // Wait for lazy XHR to render
    await page.waitForTimeout(3000)

    // Click all "Show more" / "See more" to expand bullets and additional roles
    try {
      await page.evaluate(() => {
        document.querySelectorAll('button, span[role="button"], a[role="button"]').forEach(el => {
          const txt = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim()
          if (txt.includes('show more') || txt.includes('see more') || txt.includes('show all')) {
            el.click()
          }
        })
      })
      await page.waitForTimeout(1500)
    } catch { /* ignore */ }

    // Extract visible text from main content
    const text = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body
      const clone = main.cloneNode(true)
      clone.querySelectorAll([
        'script', 'style', 'nav', 'header', 'button', 'svg',
        '.artdeco-modal', '.msg-overlay-list-bubble', '.feed-following-bar',
        '.pv-open-to-carousel', '.artdeco-card__actions',
        '.feed-identity-module', '.pv-browsemap-section',
        '.pv-ads-wrapper', '.ad-banner-container',
      ].join(',')).forEach(el => el.remove())

      return (clone.innerText || clone.textContent || '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    })

    await browser.close()

    if (!text || text.length < 200) {
      return res.status(422).json({ error: 'Could not extract profile content. Profile may be private.' })
    }

    console.log(`[scrape] extracted ${text.length} chars`)
    return res.json({ profileText: text })

  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error('[scrape] error:', err.message)
    return res.status(500).json({ error: 'Scraper failed: ' + err.message })
  }
})

app.listen(PORT, '127.0.0.1', () => {
  const hasCookies = fs.existsSync(COOKIES_FILE)
  console.log(`LinkedIn scraper running on http://127.0.0.1:${PORT} [camoufox]`)
  console.log(`Cookies: ${hasCookies ? 'READY' : 'MISSING'}`)
  if (AUTH_TOKEN) console.log('Auth: Bearer token required')
})
