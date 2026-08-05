/**
 * WCAG contrast check for the Aeolus token set.
 *
 * The console's contrast failures all traced back to token VALUES, not to
 * one-off styling, so the tokens are what gets checked. Run it after touching
 * any --ae-* colour:
 *
 *   node apps/web/scripts/check-contrast.mjs
 *
 * Exits non-zero if any declared pair falls under its threshold, so it works
 * as a pre-commit or CI gate.
 */

const hex = (h) => {
  const s = h.replace("#", "")
  const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
}

/** Composite an rgba over an opaque backdrop. */
const over = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// ── The surfaces text actually lands on, darkest last ───────────────────
const SURFACE = {
  "--ae-surface":   hex("#FFFEF9"),
  "--ae-bg":        hex("#F5F1E8"),
  "--ae-surface-2": hex("#EFE9DB"),
  "--ae-surface-3": hex("#E5DCC8"),
}

// ── Foregrounds under test ──────────────────────────────────────────────
const TEXT = {
  "--ae-text":   "#1C1426",
  "--ae-text-2": "#5A5147",
  "--ae-text-3": "#675E4E", // was #8C8272 — failed AA on every surface
}

// Non-text UI: focus ring and the cascade severity ramp.
//
// The old ramp was one amber at three ALPHA steps, which is unfixable: any
// alpha low enough to read as "less severe" is also low enough to fail 3:1.
// This ramp varies lightness instead.
//
// What is checked here is the value that BOUNDS each shape, which is what
// 1.4.11 is actually about — a shape is discernible if its boundary is. The
// two lightest steps intentionally pair a pale fill with a darker border
// (`cascade.order2` / `cascade.none` in lib/design-tokens.ts), so the border
// is the meaningful figure and the fill only carries the ordering. Testing
// their fills instead would fail a design that is in fact conformant, and
// "fix" it by flattening the severity ramp back into one dark band.
const GRAPHIC = {
  "--ae-focus (solid plum)": { color: "#5B3FA8", alpha: 1 },
  "cascade direct":          { color: "#7A4A0E", alpha: 1 },
  "cascade order-1":         { color: "#A0691C", alpha: 1 },
  "cascade order-2 border":  { color: "#A0691C", alpha: 1 },
  "cascade none border":     { color: "#7C7568", alpha: 1 },
}

// Map marks are judged against the basemap, not a token surface.
const BASEMAP = hex("#FBF8F3")
const MARK = {
  "airport hub":        "#0B4F47",
  "airport focus city": "#2F6D63",
  "airport spoke":      "#4A5D55",
  "ambient ADS-B":      "#A9B3AC",
}

let failed = 0
const line = (name, target, r, min) => {
  const ok = r >= min
  if (!ok) failed++
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${name.padEnd(26)} on ${target.padEnd(16)} ${r.toFixed(2).padStart(6)} : 1  (min ${min})`,
  )
}

console.log("\nText — AA requires 4.5:1\n")
for (const [name, color] of Object.entries(TEXT)) {
  for (const [sName, s] of Object.entries(SURFACE)) line(name, sName, ratio(hex(color), s), 4.5)
}

console.log("\nNon-text UI — WCAG 1.4.11 requires 3:1\n")
for (const [name, { color, alpha }] of Object.entries(GRAPHIC)) {
  for (const [sName, s] of Object.entries(SURFACE)) {
    line(name, sName, ratio(over(hex(color), alpha, s), s), 3)
  }
}

console.log("\nMap marks vs basemap #FBF8F3 — 3:1, and vs each other\n")
for (const [name, color] of Object.entries(MARK)) {
  line(name, "basemap", ratio(hex(color), BASEMAP), name === "ambient ADS-B" ? 1 : 3)
}
// The bug that hid 11 airports: spoke vs ambient traffic were 1.36:1 apart.
line(
  "spoke vs ambient",
  "each other",
  ratio(hex(MARK["airport spoke"]), hex(MARK["ambient ADS-B"])),
  3,
)

console.log(failed ? `\n${failed} failing pair(s)\n` : "\nAll pairs pass.\n")
process.exit(failed ? 1 : 0)
