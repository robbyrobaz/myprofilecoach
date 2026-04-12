const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')
const EXECUTABLE = process.env.CHROMIUM_PATH || '/snap/bin/chromium'

;(async () => {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage','--disable-gpu','--single-process'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  })
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'))
  await context.addCookies(cookies)
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  await page.goto('https://www.linkedin.com/in/tessa-hartwig72612/', { waitUntil: 'load', timeout: 45000 })
  await new Promise(r => setTimeout(r, 4000))

  const title = await page.title()
  console.log('TITLE:', title)

  const bodyText = await page.evaluate(() => document.body.innerText)
  console.log('Body length:', bodyText.length)
  console.log('Has ALA:', bodyText.includes('American Leadership'))
  console.log('Has Aravada in experience:', bodyText.toLowerCase().includes('generate and nurture'))

  // Save body text to file for inspection
  fs.writeFileSync('/tmp/linkedin_page.txt', bodyText)
  console.log('Full text saved to /tmp/linkedin_page.txt')

  await browser.close()
})()
