/**
 * Ad-hoc screenshot: one route, one viewport, with optional pre-actions.
 *
 *   node scripts/shot.mjs <url> <w> <h> <out.png> [settleMs] [closePanel]
 *
 * Separate from ui-audit.mjs on purpose — the audit measures the DEFAULT state
 * and must stay reproducible, while looking at a specific interaction (panel
 * closed, flight selected) is a one-off.
 */
import { chromium } from "playwright"
import fs from "node:fs"

const [url, w, h, out, settle = "12000", closePanel = ""] = process.argv.slice(2)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
await ctx.addInitScript(([close]) => {
  try {
    localStorage.setItem("aeolus-cookie-consent", "essential")
    if (close) localStorage.setItem("aeolus-col-open", "0")
  } catch {}
}, [!!closePanel])

const page = await ctx.newPage()
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 })
await page.waitForTimeout(+settle)

const session = await page.context().newCDPSession(page)
const { data } = await session.send("Page.captureScreenshot", { format: "png" })
fs.writeFileSync(out, Buffer.from(data, "base64"))
await browser.close()
console.log("wrote " + out)
