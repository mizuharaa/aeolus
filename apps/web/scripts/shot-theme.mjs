/** Screenshot the console in a given theme. node scripts/shot-theme.mjs <light|dark> <out.png> */
import { chromium } from "playwright"
import fs from "node:fs"

const [theme, out] = process.argv.slice(2)
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(([t]) => {
  try {
    localStorage.setItem("aeolus-cookie-consent", "essential")
    localStorage.setItem("aeolus-console-theme", t)
  } catch {}
}, [theme])
const page = await ctx.newPage()
const errs = []
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)))
await page.goto("http://localhost:3000/simulator", { waitUntil: "domcontentloaded", timeout: 90000 })
await page.waitForTimeout(15000)
const s = await page.context().newCDPSession(page)
const { data } = await s.send("Page.captureScreenshot", { format: "png" })
fs.writeFileSync(out, Buffer.from(data, "base64"))
console.log("wrote " + out + (errs.length ? "\nERRORS:\n" + [...new Set(errs)].join("\n") : ""))
await browser.close()
