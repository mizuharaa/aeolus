/**
 * Aeolus UI audit harness.
 *
 * Drives a real Chromium against the dev server and reports, per route:
 *   - screenshots at desktop + mobile
 *   - every text node whose measured contrast is under WCAG AA
 *   - every pair of interactive elements whose hit rects OVERLAP (UI collisions)
 *   - interactive targets under 24px (WCAG 2.5.8)
 *   - horizontal overflow
 *
 * Contrast is measured from COMPUTED colour with real background resolution
 * (walking up ancestors until an opaque background is found), not from source
 * tokens — the whole point is to catch what actually renders.
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.BASE || "http://localhost:3000"
const OUT = process.argv[2] || "shots"
fs.mkdirSync(OUT, { recursive: true })

const ALL_ROUTES = [
  { name: "landing", url: "/", settle: 3500 },
  // 13s: the ADS-B fetch resolves well after first paint, and screenshotting
  // before it lands photographs an empty map and reports it as a finding.
  { name: "simulator", url: "/simulator", settle: 13000 },
]
// ONLY=simulator narrows the run — the dev server compiles a cold route well
// past a sane goto timeout, so warming and auditing are separated in practice.
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null
const ROUTES = ONLY ? ALL_ROUTES.filter((r) => ONLY.includes(r.name)) : ALL_ROUTES
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]

/** WCAG relative luminance + contrast ratio. */
const PROBE = `(() => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  const lum = ([r,g,b]) => 0.2126*srgb(r) + 0.7152*srgb(g) + 0.0722*srgb(b)
  const ratio = (a,b) => { const [x,y] = [lum(a), lum(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05) }
  const parse = (s) => {
    const m = s && s.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number)
    return { rgb: [p[0],p[1],p[2]], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg, a) => fg.map((c,i) => Math.round(c*a + bg[i]*(1-a)))

  /**
   * Does this element or an ancestor paint a GRADIENT or IMAGE behind the text?
   *
   * If so the ratio below is not measurable from computed style: the effective
   * background varies per pixel, and backgroundColor reports whatever sits
   * UNDER the gradient — which for a scrim is the very surface the scrim exists
   * to hide. Reporting those as failures is worse than not reporting them,
   * because it buries real findings under noise that cannot be fixed in CSS.
   * They are counted separately as "unmeasurable" and must be checked by eye.
   */
  const gradientBehind = (el) => {
    let node = el
    while (node && node !== document.documentElement) {
      const bi = getComputedStyle(node).backgroundImage
      if (bi && bi !== "none") return true
      node = node.parentElement
    }
    return false
  }

  /** Walk ancestors compositing translucent backgrounds until opaque. */
  const bgOf = (el) => {
    let stack = [], node = el
    while (node && node !== document.documentElement) {
      const p = parse(getComputedStyle(node).backgroundColor)
      if (p && p.a > 0) { stack.push(p); if (p.a >= 0.999) break }
      node = node.parentElement
    }
    const rootP = parse(getComputedStyle(document.documentElement).backgroundColor)
    let base = (rootP && rootP.a >= 0.999) ? rootP.rgb : [255,255,255]
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i].rgb, base, stack[i].a)
    return base
  }

  // An INERT subtree cannot be focused, cannot be hit-tested and is removed
  // from the accessibility tree — so its contents are not collision partners
  // and not tab stops, even though querySelectorAll still returns them and
  // getBoundingClientRect still gives them a box. Without this the harness
  // reported ~40 phantom collisions between the mobile overlay panel and the
  // map markers sitting inert behind it, which is the layout working.
  const inertly = (el) => !!el.closest("[inert]")

  // Visually-hidden text (the sr-only clip pattern) is FOR screen readers, so
  // its colour never reaches a human eye and its contrast ratio is meaningless.
  // Reporting it as a failure is noise that buries real findings — a table
  // caption added for accessibility should not read as an accessibility bug.
  const srOnly = (el) => {
    const s = getComputedStyle(el)
    if (s.clip === "rect(0px, 0px, 0px, 0px)") return true
    if (s.clipPath === "inset(50%)") return true
    const r = el.getBoundingClientRect()
    return r.width <= 1 && r.height <= 1
  }

  const vis = (el) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    return s.display !== "none" && s.visibility !== "hidden" && parseFloat(s.opacity) > 0.05
      && r.width > 0 && r.height > 0 && !inertly(el) && !srOnly(el)
  }
  const label = (el) => {
    const t = (el.innerText || el.textContent || "").trim().replace(/\\s+/g," ").slice(0,44)
    const id = el.id ? "#" + el.id : ""
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\\s+/).slice(0,2).join(".") : ""
    return el.tagName.toLowerCase() + id + cls + (t ? ' "' + t + '"' : "")
  }

  // ── contrast over every element that renders its OWN text ──────────
  const contrast = []
  const unmeasurable = []
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el)) continue
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own) continue
    const s = getComputedStyle(el)
    const fgP = parse(s.color); if (!fgP) continue
    // Transparent text is background-clip:text (the marquee) — the glyph fill
    // comes from a gradient, so the colour property says nothing about what
    // actually renders. NB: no backticks anywhere in this string, it is a
    // template literal.
    if (fgP.a === 0 || gradientBehind(el)) {
      unmeasurable.push({ el: label(el), why: fgP.a === 0 ? "transparent text fill" : "gradient background" })
      continue
    }
    const bg = bgOf(el)
    const fg = fgP.a >= 0.999 ? fgP.rgb : over(fgP.rgb, bg, fgP.a)
    const size = parseFloat(s.fontSize)
    const weight = parseInt(s.fontWeight) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    const got = ratio(fg, bg)
    if (got < need) contrast.push({
      el: label(el), size, weight, need,
      got: +got.toFixed(2), color: s.color, bg: "rgb(" + bg.join(",") + ")",
    })
  }

  // ── interactive targets: size + pairwise overlap ────────────────────
  const SEL = 'a[href],button,input,select,textarea,[role="button"],[role="tab"],[role="link"],[role="separator"],[tabindex]:not([tabindex="-1"])'
  const nodes = [...document.querySelectorAll(SEL)].filter(vis).map(el => ({
    el, r: el.getBoundingClientRect(), name: label(el),
  })).filter(n => n.r.bottom > 0 && n.r.top < innerHeight && n.r.right > 0 && n.r.left < innerWidth)

  const small = nodes.filter(n => n.r.width < 24 || n.r.height < 24)
    .map(n => ({ el: n.name, w: +n.r.width.toFixed(1), h: +n.r.height.toFixed(1) }))

  // A pane that CONTAINS overlays rather than competing with them is not a
  // collision partner. Leaflet's container is focusable (tabIndex 0, arrow-key
  // pannable) so it enters the candidate set, but every map overlay is
  // positioned over it by design — without this the harness reported the
  // search box, both projection buttons and the panel launcher as "colliding
  // with the map", which is the layout working correctly.
  const isCanvasPane = (el) =>
    el.classList.contains("leaflet-container") ||
    !!el.querySelector(":scope > .leaflet-pane") ||
    el.clientWidth * el.clientHeight > innerWidth * innerHeight * 0.35

  // Map markers overlapping EACH OTHER is data density, not a layout defect —
  // aircraft converge on hubs, that is what a hub is. Counted separately so a
  // busy map cannot bury the collisions that are real: a control landing on
  // another control. Overlap between a marker and a non-marker still counts.
  const isMapMark = (el) => el.classList.contains("leaflet-marker-icon")

  const collisions = []
  let markerCrowding = 0
  for (let i = 0; i < nodes.length; i++) for (let j = i+1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j]
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue
    if (isCanvasPane(a.el) || isCanvasPane(b.el)) continue
    if (isMapMark(a.el) && isMapMark(b.el)) {
      const ox0 = Math.min(a.r.right,b.r.right) - Math.max(a.r.left,b.r.left)
      const oy0 = Math.min(a.r.bottom,b.r.bottom) - Math.max(a.r.top,b.r.top)
      if (ox0 > 1 && oy0 > 1) markerCrowding++
      continue
    }
    const ox = Math.min(a.r.right,b.r.right) - Math.max(a.r.left,b.r.left)
    const oy = Math.min(a.r.bottom,b.r.bottom) - Math.max(a.r.top,b.r.top)
    if (ox <= 1 || oy <= 1) continue
    const area = ox*oy
    const frac = area / Math.min(a.r.width*a.r.height, b.r.width*b.r.height)
    if (frac < 0.12) continue
    // Which one actually receives the click at the shared centre?
    const cx = Math.max(a.r.left,b.r.left) + ox/2, cy = Math.max(a.r.top,b.r.top) + oy/2
    const hit = document.elementFromPoint(cx, cy)
    const winner = hit ? (a.el.contains(hit) ? "A" : b.el.contains(hit) ? "B" : "neither") : "none"
    collisions.push({ a: a.name, b: b.name, overlapPx: Math.round(area), frac: +frac.toFixed(2), receivesClick: winner })
  }

  return {
    contrast: contrast.sort((x,y)=>x.got-y.got),
    unmeasurable, markerCrowding,
    small, collisions: collisions.sort((x,y)=>y.frac-x.frac),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1
      ? { scrollWidth: document.documentElement.scrollWidth, inner: innerWidth } : null,
  }
})()`

/**
 * Screenshot via CDP rather than `page.screenshot`.
 *
 * The landing runs two react-three-fiber canvases plus a 90s infinite CSS pan.
 * Playwright's screenshot path waits for the page to reach a stable state and
 * on this page it never does — every option combination (`animations:
 * "disabled"`, `"allow"`, longer timeouts) still hung, because the wait is on
 * rAF quiescence and the render loop is the point of the page. CDP's
 * `Page.captureScreenshot` grabs the current frame with no stability wait,
 * which is exactly the semantics an audit of a continuously-animating surface
 * wants: photograph what is on screen right now.
 */
async function shoot(page, file) {
  const session = await page.context().newCDPSession(page)
  try {
    const { data } = await session.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
    fs.writeFileSync(file, Buffer.from(data, "base64"))
  } finally {
    await session.detach().catch(() => {})
  }
}

const browser = await chromium.launch()
const report = {}

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 })
  // Record a consent choice BEFORE first paint. The banner is a legitimate
  // first-visit overlay, but leaving it up means every run measures the app
  // underneath a 760px dialog and reports its buttons as colliding with
  // whatever they happen to land on. Auditing the steady state is the point.
  await ctx.addInitScript(() => {
    try { localStorage.setItem("aeolus-cookie-consent", "essential") } catch {}
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 220)) })
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + String(e).slice(0, 220)))

  for (const route of ROUTES) {
    const key = `${route.name}-${vp.name}`
    try {
      await page.goto(BASE + route.url, { waitUntil: "domcontentloaded", timeout: 60000 })
      await page.waitForTimeout(route.settle)
      await shoot(page, path.join(OUT, `${key}.png`))
      report[key] = await page.evaluate(PROBE)

      // Landing: also capture the scroll beats so the GSAP staging is visible.
      if (route.name === "landing" && vp.name === "desktop") {
        for (const f of [0.06, 0.12, 0.18, 0.26, 0.4, 0.6]) {
          await page.evaluate((frac) => window.scrollTo({ top: document.body.scrollHeight * frac, behavior: "instant" }), f)
          await page.waitForTimeout(1600)
          await shoot(page, path.join(OUT, `landing-scroll-${String(f).replace(".", "")}.png`))
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
      }
    } catch (e) {
      report[key] = { error: String(e).slice(0, 400) }
    }
  }
  report[`console-${vp.name}`] = [...new Set(consoleErrors)].slice(0, 25)
  await ctx.close()
}

await browser.close()
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))

// ── console summary ──────────────────────────────────────────────────
for (const [key, r] of Object.entries(report)) {
  if (key.startsWith("console-")) {
    if (r.length) console.log(`\n## ${key}\n` + r.map((e) => "  ! " + e).join("\n"))
    continue
  }
  if (r.error) { console.log(`\n## ${key}\n  ERROR ${r.error}`); continue }
  console.log(`\n## ${key}`)
  console.log(`  contrast failures : ${r.contrast.length}`)
  console.log(`  unmeasurable      : ${(r.unmeasurable || []).length}  (gradient/clipped text — check by eye)`)
  console.log(`  collisions        : ${r.collisions.length}`)
  console.log(`  marker crowding   : ${r.markerCrowding ?? 0}  (map marks over each other — density, not a defect)`)
  console.log(`  sub-24px targets  : ${r.small.length}`)
  console.log(`  horizontal overflow: ${r.overflowX ? JSON.stringify(r.overflowX) : "none"}`)
  for (const c of r.contrast.slice(0, 14))
    console.log(`   [${c.got} < ${c.need}] ${c.size}px/${c.weight} ${c.color} on ${c.bg} — ${c.el}`)
  for (const c of r.collisions.slice(0, 12))
    console.log(`   [overlap ${c.frac} → ${c.receivesClick}] ${c.a}  ><  ${c.b}`)
  for (const s of r.small.slice(0, 8)) console.log(`   [${s.w}x${s.h}] ${s.el}`)
}
