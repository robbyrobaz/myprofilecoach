/**
 * LinkedIn profile scraper — connects to a persistent Chrome instance via CDP.
 *
 * The Chrome instance lives in chrome-session/ and has LinkedIn already logged in.
 * We reuse that session — no cookie injection, no fresh browser launches, no bot detection.
 *
 * To set up / re-login:
 *   ./linkedin-login.sh          (opens visible Chrome → log in → close window)
 *   systemctl --user restart linkedin-chrome
 *
 * POST /scrape  { url: "https://www.linkedin.com/in/username" }
 *   → { profileText: "..." }
 */

const express = require('express')
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = parseInt(process.env.PORT || '3099', 10)
const AUTH_TOKEN = process.env.SCRAPER_TOKEN || ''
const CDP_URL = `http://127.0.0.1:${process.env.CDP_PORT || '18801'}`
const SESSION_PROFILE = path.join(__dirname, 'chrome-session')

const app = express()
app.use(express.json())

const HEALTH = ['/health', '/linkedin-scraper/health']
const SCRAPE = ['/scrape', '/linkedin-scraper/scrape']

// Cached CDP browser connection
let _browser = null

async function getBrowser() {
  if (_browser) {
    try {
      _browser.contexts() // throws if disconnected
      return _browser
    } catch {
      console.log('[cdp] Browser disconnected, reconnecting...')
      _browser = null
    }
  }
  _browser = await chromium.connectOverCDP(CDP_URL)
  console.log('[cdp] Connected to Chrome at', CDP_URL)
  return _browser
}

app.get(HEALTH, async (_req, res) => {
  try {
    await getBrowser()
    res.json({ ok: true, engine: 'chrome-cdp', cdpUrl: CDP_URL })
  } catch {
    res.status(503).json({ ok: false, error: 'Chrome not reachable. Run: systemctl --user start linkedin-chrome' })
  }
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

  console.log(`[scrape] ${url}`)

  let page
  try {
    const browser = await getBrowser()

    // Use the existing context — it has the real LinkedIn session
    const contexts = browser.contexts()
    const ctx = contexts.length > 0 ? contexts[0] : await browser.newContext()

    page = await ctx.newPage()

    // Suppress navigator.webdriver signal on every page load
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    await page.goto(url, { waitUntil: 'load', timeout: 45000 })

    // Detect auth walls (all LinkedIn login page variants)
    const currentUrl = page.url()
    const title = await page.title()
    const bodyStart = await page.evaluate(() =>
      (document.body?.innerText || '').slice(0, 600).toLowerCase()
    )

    if (
      currentUrl.includes('authwall') || currentUrl.includes('/login') ||
      title.toLowerCase().includes('sign in') || title.toLowerCase().includes('log in') ||
      bodyStart.includes('join linkedin') || bodyStart.includes('sign in') ||
      bodyStart.includes('forgot password')
    ) {
      await page.close()
      return res.status(401).json({
        error: 'LinkedIn session expired. Run ./linkedin-login.sh to re-login, then restart linkedin-chrome service.',
      })
    }

    // Wait for React render
    await page.waitForTimeout(2000)

    // Scroll to trigger lazy-loaded Experience/Education
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const steps = Math.ceil(pageHeight / 400)
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(pos => window.scrollTo(0, pos), i * 400)
      await page.waitForTimeout(250)
    }

    // Wait for lazy XHR
    await page.waitForTimeout(2000)

    // Click "Show more" / "See more" to expand bullets and additional roles
    try {
      await page.evaluate(() => {
        document.querySelectorAll('button, span[role="button"], a[role="button"]').forEach(el => {
          const txt = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim()
          if (txt.includes('show more') || txt.includes('see more') || txt.includes('show all')) {
            el.click()
          }
        })
      })
      await page.waitForTimeout(1200)
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

    await page.close()

    if (!text || text.length < 200) {
      return res.status(422).json({ error: 'Could not extract profile content. Profile may be private.' })
    }

    console.log(`[scrape] extracted ${text.length} chars`)
    return res.json({ profileText: text })

  } catch (err) {
    if (page) await page.close().catch(() => {})
    // If Chrome went away, clear cached connection
    if (err.message?.includes('connect') || err.message?.includes('Target closed')) {
      _browser = null
    }
    console.error('[scrape] error:', err.message)
    return res.status(500).json({ error: 'Scraper failed: ' + err.message })
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`LinkedIn scraper running on http://127.0.0.1:${PORT} [chrome-cdp → ${CDP_URL}]`)
  if (AUTH_TOKEN) console.log('Auth: Bearer token required')
  // Eagerly connect so first request is fast
  getBrowser().catch(err => console.warn('[cdp] Initial connect failed:', err.message, '— will retry on first request'))
})
