const { chromium } = require('playwright-core')

async function scrapeLinkedIn(url) {
  const browser = await chromium.launch({
    executablePath: '/snap/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  })

  const page = await context.newPage()

  // Hide automation signals
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  console.log(`Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Wait for content to load
  await page.waitForTimeout(3000)

  // Check if we hit the login wall
  const loginWall = await page.$('.nav__button-secondary') // LinkedIn's "Sign in" button
  const title = await page.title()
  console.log(`Page title: ${title}`)

  if (title.toLowerCase().includes('sign in') || title.toLowerCase().includes('log in')) {
    console.log('Hit login wall — LinkedIn is blocking unauthenticated access')
    await browser.close()
    return null
  }

  // Extract profile text from main content area
  const text = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body
    const clone = main.cloneNode(true)
    // Remove noise
    clone.querySelectorAll('script,style,nav,header,button,svg,[aria-hidden="true"]').forEach(el => el.remove())
    return (clone.innerText || clone.textContent || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  })

  await browser.close()
  return text
}

scrapeLinkedIn(process.argv[2] || 'https://www.linkedin.com/in/robehartwig')
  .then(text => {
    if (!text) {
      console.log('RESULT: no content extracted')
    } else {
      console.log(`\nRESULT: ${text.length} characters extracted\n`)
      console.log('--- FIRST 1000 CHARS ---')
      console.log(text.slice(0, 1000))
    }
  })
  .catch(err => console.error('ERROR:', err.message))
