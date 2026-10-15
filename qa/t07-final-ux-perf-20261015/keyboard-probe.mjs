import { webkit, chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const results = []
for (const [name, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent('<label>Password<input id="password" type="password"></label><button id="eye">Show password</button><input id="next">')
  for (const key of ['Tab', 'Alt+Tab']) {
    await page.locator('#password').focus()
    await page.keyboard.press(key)
    results.push({ browser: name, key, focused: await page.evaluate(() => document.activeElement.id) })
  }
  await browser.close()
}
await writeFile('qa/t07-final-ux-perf-20261015/keyboard-probe.json', JSON.stringify(results, null, 2) + '\n')
process.stdout.write(JSON.stringify(results) + '\n')
