/**
 * Run this once to log into LinkedIn and save session cookies.
 * Usage: node login.js
 * After you log in and see your feed, press Enter to save and exit.
 */

const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const COOKIES_FILE = path.join(__dirname, 'linkedin-cookies.json')

async function main() {
  console.log('Launching browser — log into LinkedIn, then press Enter here to save session...\n')

  const browser = await chromium.launch({
    executablePath: '/snap/bin/chromium',
    headless: false, // visible so you can log in
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  })

  const page = await context.newPage()
  await page.goto('https://www.linkedin.com/login')

  // Wait for user to log in and press Enter
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise(resolve => rl.question('\nPress Enter after you have logged in successfully... ', resolve))
  rl.close()

  // Save cookies
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
