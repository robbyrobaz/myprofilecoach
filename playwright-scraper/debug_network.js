const { firefox } = require('playwright-core')
const { launchOptions } = require('/home/rob/.hermes/hermes-agent/node_modules/camoufox-js/dist/index.js')
const fs = require('fs')
const path = require('path')

const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')

;(async () => {
  const opts = await launchOptions({ headless: true })
  const browser = await firefox.launch(opts)
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'))
  await context.addCookies(cookies)

  const page = await context.newPage()

  // Capture all XHR/fetch calls to LinkedIn's API
  const apiCalls = []
  page.on('request', req => {
    const url = req.url()
    if (url.includes('voyager') || url.includes('/api/') || url.includes('graphql')) {
      apiCalls.push({ method: req.method(), url: url.slice(0, 120) })
    }
  })

  await page.goto('https://www.linkedin.com/in/tessa-hartwig72612/', { waitUntil: 'load', timeout: 45000 })
  await page.waitForTimeout(4000)

  // Scroll to trigger lazy loads
  await page.evaluate(() => window.scrollTo(0, 2000))
  await page.waitForTimeout(3000)

  console.log('\n=== API calls made ===')
  apiCalls.forEach(c => console.log(c.method, c.url))

  const bodyText = await page.evaluate(() => document.body.innerText)
  console.log('\nHas Experience section:', bodyText.includes('American Leadership') || bodyText.includes('Office Assistant'))
  console.log('Body length:', bodyText.length)

  await browser.close()
})()
