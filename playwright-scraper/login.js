/**
 * Run this once to log into LinkedIn with a stealth Chrome profile.
 * The session is saved to ./chrome-profile/ and reused by server.js.
 *
 * Usage:
 *   DISPLAY=:0 node login.js
 *
 * After you log in and see your feed, press Enter to save and exit.
 */

const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const path = require('path')
const readline = require('readline')

puppeteer.use(StealthPlugin())

const PROFILE_DIR = path.join(__dirname, 'chrome-profile')
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/snap/bin/chromium'

async function main() {
  console.log('Launching Chrome with stealth — log into LinkedIn, then press Enter here...\n')

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,900',
    ],
    defaultViewport: { width: 1280, height: 900 },
  })

  const page = await browser.newPage()
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'load' })

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise(resolve => rl.question('\nPress Enter after you have logged in successfully... ', resolve))
  rl.close()

  // Verify session cookie exists
  const cookies = await page.cookies('https://www.linkedin.com')
  const hasAuth = cookies.some(c => c.name === 'li_at')

  if (!hasAuth) {
    console.log('\nNo LinkedIn auth cookie found — are you logged in? Try again.')
    await browser.close()
    process.exit(1)
  }

  console.log(`\nSession saved in ${PROFILE_DIR}/ (${cookies.length} cookies)`)
  console.log('You can now run: node server.js')

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
