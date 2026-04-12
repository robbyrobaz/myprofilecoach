/**
 * LinkedIn profile scraper — Express server backed by Camoufox.
 * Camoufox is a Firefox fork with C++ fingerprint spoofing that bypasses
 * LinkedIn's bot detection (which blocks regular headless Chromium).
 *
 * Usage:
 *   node login.js   (once — saves cookies)
 *   node server.js  (runs the API)
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

const PORT = parseInt(process.env.PORT || '3099', 10)
const AUTH_TOKEN = process.env.SCRAPER_TOKEN || ''
const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')

const app = express()
app.use(express.json())

const HEALTH = ['/health', '/linkedin-scraper/health']
const SCRAPE = ['/scrape', '/linkedin-scraper/scrape']

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

  if (!fs.existsSync(COOKIES_FILE)) {
    return res.status(503).json({ error: 'No LinkedIn session found. Run node login.js first.' })
  }

  let cookies
  try {
    cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'))
  } catch {
    return res.status(503).json({ error: 'Could not read LinkedIn session cookies.' })
  }

  console.log(`[scrape] ${url}`)

  let browser
  try {
    // Launch Camoufox (Firefox with anti-fingerprint spoofing)
    const opts = await launchOptions({ headless: true })
    browser = await firefox.launch(opts)

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    })

    // Inject our LinkedIn session cookies
    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load', timeout: 45000 })

    // Check session
    const title = await page.title()
    if (title.toLowerCase().includes('sign in') || title.toLowerCase().includes('log in')) {
      await browser.close()
      return res.status(401).json({
        error: 'LinkedIn session expired. Run node login.js again to refresh.',
      })
    }

    // Wait for initial React render
    await page.waitForTimeout(2000)

    // Scroll slowly to trigger lazy-loaded Experience/Education sections
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const steps = Math.ceil(pageHeight / 400)
    for (let i = 0; i <= steps; i++) {
      await page.evaluate((pos) => window.scrollTo(0, pos), i * 400)
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

    // Extract text
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
  console.log(`Cookies: ${hasCookies ? 'READY' : 'MISSING — run node login.js first'}`)
  if (AUTH_TOKEN) console.log(`Auth: Bearer token required`)
})
