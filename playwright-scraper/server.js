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

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Wait for initial render
    await page.waitForTimeout(2000)

    // Check for session expiry before doing any work
    const title = await page.title()
    if (title.toLowerCase().includes('sign in') || title.toLowerCase().includes('log in')) {
      await browser.close()
      return res.status(401).json({
        error: 'LinkedIn session expired. Run node login.js again to refresh.',
      })
    }

    // Scroll down the full page to trigger lazy-loading of all sections
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0
        const distance = 500
        const timer = setInterval(() => {
          window.scrollBy(0, distance)
          totalHeight += distance
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 150)
      })
    })

    // Scroll back to top so LinkedIn re-renders the full profile
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    // Click all "Show more" / "See more" expand buttons in experience & about sections
    // LinkedIn uses several different button patterns for these
    const showMoreSelectors = [
      'button[aria-label*="Show more"]',
      'button[aria-label*="see more"]',
      'button.inline-show-more-text__button',
      'button.pvs-list__item--with-top-padding',
      '.lt-line-clamp__more',
      'span[role="button"].pvs-list__footer-wrapper',
      'a[data-control-name="expand_show_more_button"]',
    ]

    for (const selector of showMoreSelectors) {
      try {
        const buttons = await page.$$(selector)
        for (const btn of buttons) {
          await btn.click().catch(() => {}) // ignore if not clickable
          await page.waitForTimeout(200)
        }
      } catch { /* ignore selector errors */ }
    }

    // Also look for any button whose visible text contains "more"
    try {
      await page.evaluate(() => {
        document.querySelectorAll('button, span[role="button"]').forEach(el => {
          const txt = (el.textContent || '').toLowerCase().trim()
          if (txt === 'show more' || txt === 'see more' || txt === '…see more') {
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

      // Remove noise
      clone.querySelectorAll([
        'script', 'style', 'nav', 'header', 'button',
        'svg', '[aria-hidden="true"]', '.artdeco-modal',
        '.msg-overlay-list-bubble', '.feed-following-bar',
        '.pv-open-to-carousel', '.artdeco-card__actions',
        '.pvs-header__container button', // "Add section" buttons
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
