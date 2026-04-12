/**
 * LinkedIn profile scraper — Express HTTP server backed by Playwright.
 * Loads saved LinkedIn session cookies so it fetches authenticated profiles.
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
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = parseInt(process.env.PORT || '3099', 10)
const AUTH_TOKEN = process.env.SCRAPER_TOKEN || ''
const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')
const EXECUTABLE = process.env.CHROMIUM_PATH || '/snap/bin/chromium'

const app = express()
app.use(express.json())

// Tailscale Funnel keeps the /linkedin-scraper prefix in the path.
// Accept both /health and /linkedin-scraper/health etc.
const HEALTH = ['/health', '/linkedin-scraper/health']
const SCRAPE = ['/scrape', '/linkedin-scraper/scrape']

// Health is public
app.get(HEALTH, (_req, res) => {
  const hasCookies = fs.existsSync(COOKIES_FILE)
  res.json({ ok: true, cookiesReady: hasCookies })
})

// Auth required for scrape
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
    browser = await chromium.launch({
      executablePath: EXECUTABLE,
      headless: true,
      timeout: 15000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
      ],
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    })

    await context.addCookies(cookies)

    const page = await context.newPage()
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    await page.goto(url, { waitUntil: 'load', timeout: 45000 })

    // Check for session expiry immediately
    const title = await page.title()
    if (title.toLowerCase().includes('sign in') || title.toLowerCase().includes('log in')) {
      await browser.close()
      return res.status(401).json({
        error: 'LinkedIn session expired. Run node login.js again to refresh.',
      })
    }

    // LinkedIn renders Experience/Education sections via lazy XHR after page load.
    // Strategy: scroll slowly down the full page to trigger each section,
    // then wait for those requests to complete before extracting.
    await page.waitForTimeout(2000)

    // Scroll the whole page slowly in small steps
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const steps = Math.ceil(pageHeight / 400)
    for (let i = 0; i <= steps; i++) {
      await page.evaluate((pos) => window.scrollTo(0, pos), i * 400)
      await page.waitForTimeout(250)
    }

    // Give XHR responses time to render
    await page.waitForTimeout(3000)

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)

    // Click all "Show more" / "See more" expand buttons
    try {
      await page.evaluate(() => {
        document.querySelectorAll('button, span[role="button"], a[role="button"]').forEach(el => {
          const txt = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim()
          if (
            txt.includes('show more') || txt.includes('see more') ||
            txt.includes('show all') || txt === '…see more'
          ) {
            el.click()
          }
        })
      })
    } catch { /* ignore */ }

    await page.waitForTimeout(1500)

    // Extract clean profile text
    const text = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body
      const clone = main.cloneNode(true)

      // Remove noise — do NOT remove aria-hidden, LinkedIn may use it on real content
      clone.querySelectorAll([
        'script', 'style', 'nav', 'header', 'button',
        'svg', '.artdeco-modal',
        '.msg-overlay-list-bubble', '.feed-following-bar',
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
  console.log(`LinkedIn scraper running on http://127.0.0.1:${PORT}`)
  console.log(`Cookies: ${hasCookies ? 'READY' : 'MISSING — run node login.js first'}`)
  if (AUTH_TOKEN) console.log(`Auth: Bearer token required`)
})
