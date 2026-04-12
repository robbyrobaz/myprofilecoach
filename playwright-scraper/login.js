/**
 * Run this once to log into LinkedIn with Camoufox (Firefox-based anti-detection browser)
 * and save the session cookies for the scraper.
 *
 * Usage: node login.js
 * After you log in and see your feed, press Enter to save and exit.
 */

const { firefox } = require('playwright-core')
const { launchOptions } = require('/home/rob/.hermes/hermes-agent/node_modules/camoufox-js/dist/index.js')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')

async function main() {
  console.log('Launching Camoufox browser — log into LinkedIn, then press Enter here to save session...\n')

  // headless: false so you can visually log in
  const opts = await launchOptions({ headless: false })
  const browser = await firefox.launch(opts)

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  const page = await context.newPage()
  await page.goto('https://www.linkedin.com/login')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise(resolve => rl.question('\nPress Enter after you have logged in successfully... ', resolve))
  rl.close()

  const cookies = await context.cookies()
  const hasAuth = cookies.some(c => c.name === 'li_at')

  if (!hasAuth) {
    console.log('\nNo LinkedIn auth cookie found — are you logged in? Try again.')
    await browser.close()
    process.exit(1)
  }

  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2))
  console.log(`\nSession saved to ${COOKIES_FILE} (${cookies.length} cookies)`)
  console.log('You can now run: node server.js')

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
