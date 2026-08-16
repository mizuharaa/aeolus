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
  "cascade direct":          { color: "#3A2408", alpha: 1 },
  "cascade order-1":         { color: "#9C6C28", alpha: 1 },
  "cascade order-2 border":  { color: "#7E5A1C", alpha: 1 },
  "cascade none border":     { color: "#7C7568", alpha: 1 },
}

// The ramp's ADJACENT STEPS, which is the check this file was missing.
//
// Every step used to pass the block above — each one individually cleared 3:1
// against the paper — while the ramp as a whole was invisible, because nothing
// asserted that consecutive steps differ from EACH OTHER. Measured on the old
// values: 1.61:1 and 1.53:1, with a full span of 2.47:1. A severity ramp whose
// neighbours are 1.5:1 apart is one colour with extra steps, and the gate said
// it was fine. Ordering is what this encoding means, so ordering is gated.
const RAMP = [
  ["direct", "#3A2408"],
  ["order-1", "#9C6C28"],
  ["order-2 fill", "#E9D6B6"],
]

// Map marks are judged against the basemap, not a token surface.
const BASEMAP = hex("#FBF8F3")
const MARK = {
  "airport hub":        "#0B4F47",
  "airport focus city": "#2F6D63",
  "airport spoke":      "#4A5D55",
  // Operating = blue, cancelled = grey. Grey must stay unique to cancelled, so
  // both flying tiers live in the blue family.
  "flight operating":   "#1C6FA8",
  "ambient ADS-B":      "#8FB0C9",
  // Cancelled is a pale disc with a dark dashed border and a dark glyph. As
  // with the cascade ramp's light steps, the BORDER is the figure here — a
  // pale fill is the point, so testing the fill would fail a mark that is in
  // fact conformant and "fix" it by making cancelled loud again.
  "flight cancelled (border)": "#333935",
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

console.log("\nCascade ramp — consecutive steps must be 3:1 apart from each other\n")
for (let i = 0; i < RAMP.length - 1; i++) {
  const [aName, aHex] = RAMP[i]
  const [bName, bHex] = RAMP[i + 1]
  line(`${aName} -> ${bName}`, "each other", ratio(hex(aHex), hex(bHex)), 3)
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
// Operating vs cancelled carries the most consequential distinction on the map,
// so it is asserted rather than left to whoever edits the palette next.
line(
  "operating vs cancelled fill",
  "each other",
  ratio(hex(MARK["flight operating"]), hex("#C9CCC9")),
  1.6,
)

// DESIGN.md: "Operating stays LIGHTER than cascade-direct so a nominal flight
// can never out-weigh a disrupted one." That is an ORDERING, not a ratio, and
// it was previously only prose — so re-inking either pigment could silently
// invert the map's weight hierarchy while every ratio above still passed.
{
  const direct = ratio(hex("#3A2408"), BASEMAP)
  const operating = ratio(hex(MARK["flight operating"]), BASEMAP)
  const ok = direct > operating
  if (!ok) failed++
  console.log(
    `\n${ok ? "  ok  " : "  FAIL"} cascade-direct out-weighs operating blue on the basemap  ` +
      `(${direct.toFixed(2)} > ${operating.toFixed(2)})`,
  )
}

console.log(failed ? `\n${failed} failing pair(s)\n` : "\nAll pairs pass.\n")
process.exit(failed ? 1 : 0)
