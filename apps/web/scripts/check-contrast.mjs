/**
 * WCAG contrast check for the Aeolus token set — BOTH registers.
 *
 * The console's contrast failures all traced back to token VALUES, not to
 * one-off styling, so the tokens are what gets checked. Run it after touching
 * any --ae-* colour:
 *
 *   node apps/web/scripts/check-contrast.mjs
 *
 * Exits non-zero if any declared pair falls under its threshold, so it works
 * as a pre-commit or CI gate.
 *
 * ── 2026-08-16: SURFACE SEPARATION, and why this file kept saying "fine" ──
 *
 * A live audit of the console reported ZERO text-contrast failures while the
 * screen was, in the user's words, at "subzero contrast". Both things were
 * true. Every foreground/background PAIR passed AA in isolation, because that
 * is the only question this file used to ask — and the four surfaces those
 * pairs were drawn on (#F5F1E8 / #FFFEF9 / #EFE9DB / #E5DCC8) sat inside a 4%
 * lightness band. A panel could not be told from the floor it rested on, a tab
 * well could not be told from its bar, and the map could not be told from the
 * page. There was no figure and no ground anywhere on the surface.
 *
 * WCAG has nothing to say about this: 1.4.3 governs text against ITS OWN
 * background and 1.4.11 governs a control's boundary, so a design can pass
 * both completely while being unreadable as a LAYOUT. That is a real blind
 * spot in the standard, and the fix is not to relax the text checks but to add
 * the check the standard omits. SEPARATION below asserts that consecutive
 * surfaces in the elevation stack differ by at least a minimum ratio, so a
 * future re-ink cannot collapse the console back into fog while this gate
 * reports success.
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

let failed = 0
const line = (name, target, r, min) => {
  const ok = r >= min
  if (!ok) failed++
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${name.padEnd(30)} on ${target.padEnd(18)} ${r.toFixed(2).padStart(6)} : 1  (min ${min})`,
  )
}

// ══════════════════════════════════════════════════════════════════════
// Register definitions. Both are checked on every run — the paper register
// still ships on the landing, docs and legal pages.
// ══════════════════════════════════════════════════════════════════════

const REGISTERS = {
  "paper (:root — landing, docs, legal)": {
    // Surfaces text actually lands on, in ELEVATION ORDER (floor first).
    surfaces: {
      "--ae-bg":        "#F2EDE1",
      "--ae-surface-2": "#E6DCC6",
      "--ae-surface-3": "#D3C4A4",
      "--ae-surface":   "#FFFEF9",
      "--ae-raised":    "#F5EEDF",
    },
    // The order separation is measured along. `--ae-surface` is the card and
    // sits ABOVE the floor even though it is lighter, so the stack is compared
    // as floor → well → track and card → floor separately.
    stack: ["--ae-bg", "--ae-surface-2", "--ae-surface-3"],
    card: ["--ae-surface", "--ae-bg"],
    // On paper the panel is already the lightest surface, so a card raises by
    // stepping TOWARD the floor tint rather than away from it.
    raised: ["--ae-surface", "--ae-raised"],
    /**
     * The separation floor is PER REGISTER, and this one stays at 1.12.
     *
     * The console board moved to 1.25 on 2026-08-19 because it is a dense
     * operational surface whose figure and ground rest on nothing but the
     * surface step. The landing is not that: it separates by staging, scale,
     * imagery and whitespace, and it is the one surface a console rebuild is
     * explicitly forbidden to re-ink — ten-plus landing components read these
     * values directly. Applying the console's floor here would fail three
     * pairs and force exactly the change that is off-limits.
     */
    separationMin: 1.12,
    text: {
      "--ae-text":   "#1C1426",
      "--ae-text-2": "#564D43",
      "--ae-text-3": "#56503F", // was #8C8272 — failed AA on every surface
    },
    graphic: {
      "--ae-focus (solid plum)": "#5B3FA8",
    },
  },

  /**
   * CONSOLE — THE PAPER BOARD, the console's one and only register from
   * 2026-08-19. Replaces both the cool-grey "Hairline Mosaic" board and the
   * dark register that sat beside it; three registers existed at once and the
   * console had drifted off the product's own beige world. The landing keeps
   * `:root` and is gated separately above — never merge the two.
   */
  "console (.simulator-shell — the paper board)": {
    surfaces: {
      "--ae-surface":   "#FFFEF9",
      "--ae-bg":        "#E8DFCB",
      "--ae-surface-2": "#D2C4A5",
      "--ae-surface-3": "#BFAE88",
    },
    // A module is the lightest thing, the floor sits below it, wells recess
    // further. That is what lets both "raised" and "recessed" read with no
    // shadow — and with the split-flap seam demoted to a motion artifact,
    // this ladder is now the ONLY channel carrying figure and ground.
    stack: ["--ae-surface", "--ae-bg", "--ae-surface-2", "--ae-surface-3"],
    card: ["--ae-surface", "--ae-bg"],
    // No `raised` rung: a card inside a module steps DOWN to the floor
    // colour, so it is the same step as `card`. --ae-raised is retired.
    text: {
      "--ae-text":   "#1C1426",
      "--ae-text-2": "#38332A",
      // Was #56503F, which measures 3.68:1 on --ae-surface-3 — an AA failure
      // created by raising the separation floor. Re-inked to clear 4.5:1 on
      // every surface in the ladder.
      "--ae-text-3": "#443F31",
    },
    graphic: {
      "--ae-focus (solid plum)": "#5B3FA8",
      "--ae-teal (graphic)":     "#5B3FA8",
      // Re-inked DOWN from #B8863C, which measures 2.43:1 as a mark on the
      // deeper paper floor. #9A6B27 is the lightest value clearing both the
      // 3:1 mark minimum and 4.5:1 as text.
      "--ae-amber":              "#9A6B27",
      "--ae-rose":               "#C13A6B",
      // Cascade ramp, gated on ADJACENCY as well as on the surfaces.
      "cascade 0 (direct)":      "#1E1533",
      "cascade 1 (first order)": "#906520",
      "cascade 2 border":        "#5E4E2E",
      "operating blue":          "#1C6FA8",
      // rgba(28,20,38,0.42) composited over --ae-surface-3, its worst case.
      "--ae-line-strong":        "#7E7460",
    },
    // Consecutive cascade steps must clear 3:1 of EACH OTHER, not just of
    // the paper. The ramp once measured 1.61:1 and 1.53:1 between neighbours
    // while every step passed against the surface, so the product's core
    // encoding rendered as one brown.
    ramp: ["#1E1533", "#906520", "#DCD2B9"],
    // See design.md: the board's separation rests on the surface step alone
    // now that the split-flap seam is a motion artifact.
    separationMin: 1.25,
    /**
     * WHERE A MARK MAY LAND, and why this list exists.
     *
     * The gate used to test every pigment against every surface. On a shallow
     * ladder that was harmless. On this one it fails gold, rose, first-order
     * and line-strong against `--ae-surface-2` and `--ae-surface-3` — and the
     * only way to pass would be to ink the whole palette toward black, which
     * would destroy the world to satisfy a case that never renders.
     *
     * A mark is drawn on a module face or on the board floor. `--ae-surface-2`
     * is a well and a tab bar; `--ae-surface-3` is a track fill and a deep
     * recess. Neither ever carries a pigment mark — they carry TEXT, which is
     * still checked against them at 4.5:1 above, and that is the check that
     * matters there. Narrowing this is a design rule, not a relaxation: if a
     * mark ever needs to sit on a well, the rule is to raise the surface, not
     * to widen this list.
     */
    markSurfaces: ["--ae-surface", "--ae-bg"],
  },

}

for (const [regName, reg] of Object.entries(REGISTERS)) {
  console.log(`\n\n══ ${regName} ══`)

  console.log("\nText — AA requires 4.5:1\n")
  for (const [name, color] of Object.entries(reg.text)) {
    for (const [sName, s] of Object.entries(reg.surfaces)) {
      line(name, sName, ratio(hex(color), hex(s)), 4.5)
    }
  }

  // A pigment is checked against the surfaces a MARK can actually land on.
  // Absent `markSurfaces` that is every surface, which is the right default
  // for a shallow ladder; the board narrows it. See the note on its entry.
  const markOn = reg.markSurfaces
    ? Object.fromEntries(reg.markSurfaces.map((k) => [k, reg.surfaces[k]]))
    : reg.surfaces
  console.log("\nNon-text UI — WCAG 1.4.11 requires 3:1\n")
  for (const [name, color] of Object.entries(reg.graphic)) {
    for (const [sName, s] of Object.entries(markOn)) {
      line(name, sName, ratio(hex(color), hex(s)), 3)
    }
  }

  // ── SURFACE SEPARATION — the check WCAG does not cover ──────────────
  //
  // 1.25:1 is not a WCAG number; there is no WCAG number for this. It is set
  // where a surface step becomes perceptible as an EDGE without a border, which
  // is the job these steps do. The paper register measured 1.04–1.07:1 between
  // consecutive surfaces before this file existed, which is why the console
  // read as one flat field despite every text pair passing.
  //
  // RAISED 1.12 -> 1.25 on 2026-08-19. The board that replaced that register
  // passed this check at 1.17 / 1.15 / 1.17 and its user still reported the
  // screen as having no contrast. A threshold that admits the exact failure
  // it exists to prevent is not a gate. The rebuild also removed the static
  // split-flap seam, so the surface step is now the ONLY channel carrying
  // figure and ground, which is the second reason the floor had to move.
  const sepMin = reg.separationMin ?? 1.25
  console.log(`\nSurface separation — consecutive elevation steps, min ${sepMin}:1\n`)
  for (let i = 0; i < reg.stack.length - 1; i++) {
    const a = reg.stack[i]
    const b = reg.stack[i + 1]
    line(`${a} -> ${b}`, "each other", ratio(hex(reg.surfaces[a]), hex(reg.surfaces[b])), sepMin)
  }
  line(
    `${reg.card[0]} -> ${reg.card[1]}`,
    "card vs floor",
    ratio(hex(reg.surfaces[reg.card[0]]), hex(reg.surfaces[reg.card[1]])),
    sepMin,
  )
  if (reg.ramp) {
    console.log("\nCascade ramp — consecutive steps, min 3:1 of EACH OTHER\n")
    for (let i = 0; i < reg.ramp.length - 1; i++) {
      line(`${reg.ramp[i]} -> ${reg.ramp[i + 1]}`, "each other", ratio(hex(reg.ramp[i]), hex(reg.ramp[i + 1])), 3)
    }
  }

  if (reg.raised) {
    line(
      `${reg.raised[0]} -> ${reg.raised[1]}`,
      "raised vs panel",
      ratio(hex(reg.surfaces[reg.raised[0]]), hex(reg.surfaces[reg.raised[1]])),
      sepMin,
    )
  }
}

// ══════════════════════════════════════════════════════════════════════
// GLASS — translucent panels, gated on their COMPOSITED result.
//
// Added 2026-08-17 with the Hairline Mosaic rebuild, because a glass token is
// the one surface whose declared value tells you nothing about what ships. A
// panel declared `rgba(255,255,255,0.86)` is not white; it is whatever it
// becomes over the thing behind it, and the thing behind it here is a map.
//
// The finding this block exists to record: a white glass panel over the
// Positron basemap composites to 1.10:1 against the tile. The FILL cannot
// carry the panel's boundary and no alpha value rescues it — white over
// near-white has nowhere left to go. So the EDGE carries it, which is the same
// remedy `order2` uses in the cascade ramp above. Both halves are asserted:
// text must stay readable ON the glass, and the edge must stay visible AGAINST
// the backdrop. Asserting only the first would pass an invisible panel.
// ══════════════════════════════════════════════════════════════════════

const GLASS = {
  "console light": {
    // The Positron `light_all` tile, sampled after the basemap filter.
    backdrop: "#FBF8F3",
    // The darkest thing the glass realistically sits on — water and road
    // casing. Text readability is gated against THIS, not the pale tile.
    backdropDark: "#808890",
    fill: { color: "#FFFFFF", alpha: 0.86 },
    edge: { color: "#14161A", alpha: 0.55 },
    text: "#14161A",
  },
  "console dark": {
    backdrop: "#1A1D24",
    backdropDark: "#1A1D24",
    fill: { color: "#101218", alpha: 0.84 },
    edge: { color: "#E9ECF5", alpha: 0.42 },
    text: "#F2F3F7",
  },
}

console.log("\n\n══ glass — composited, not nominal ══")
for (const [name, g] of Object.entries(GLASS)) {
  console.log(`\n${name}\n`)
  const onPale = over(hex(g.fill.color), g.fill.alpha, hex(g.backdrop))
  const onDark = over(hex(g.fill.color), g.fill.alpha, hex(g.backdropDark))
  // Body text on the glass, measured over the WORST backdrop it can cover.
  line("text on glass", "worst backdrop", ratio(hex(g.text), onDark), 4.5)
  // The edge is the panel's boundary, so WCAG 1.4.11's 3:1 applies to it.
  const edgeOnMap = over(hex(g.edge.color), g.edge.alpha, hex(g.backdrop))
  line("glass edge", "vs basemap", ratio(edgeOnMap, hex(g.backdrop)), 3)
  // Recorded, not asserted: this is the ratio that forced the edge treatment.
  const fillSep = ratio(onPale, hex(g.backdrop))
  console.log(
    `  note  ${"glass fill -> basemap".padEnd(30)} on ${"separation".padEnd(18)} ` +
      `${fillSep.toFixed(2).padStart(6)} : 1  (edge carries the boundary instead)`,
  )
}

// ══════════════════════════════════════════════════════════════════════
// Cascade severity ramp — console register only (the landing does not draw it).
//
// INVERTED 2026-08-16 for the dark floor: severity now runs light→dark, so the
// direct hit is the BRIGHTEST mark on the console. See the long note on
// `cascade` in lib/design-tokens.ts for why the middle step gets the border
// treatment rather than a third lightness step — briefly, requiring all three
// steps to clear 3:1 against the panel AND 3:1 of each other needs a colour
// with luminance above 1.0, which does not exist. The constraint is identical
// in both directions; only which step is "pale" flips.
// ══════════════════════════════════════════════════════════════════════

const PANEL = hex("#14161C")

console.log("\n\n══ cascade severity ramp (console) ══")
console.log("\nEach step must be discernible against the panel — 3:1\n")
const RAMP_VS_SURFACE = {
  "direct fill":       "#FFD07A",
  "order-1 fill":      "#9E6726",
  "order-2 border":    "#7D6437", // dark fill; the BORDER is the figure
  "none border":       "#5C6474",
  "cancelled border":  "#7C8494",
}
for (const [name, color] of Object.entries(RAMP_VS_SURFACE)) {
  line(name, "--ae-surface", ratio(hex(color), PANEL), 3)
}

// The pair an operator reads under time pressure — "was this hit, or is it
// downstream of something that was hit" — is gated at a full 3:1.
console.log("\ndirect -> order-1 must be 3:1 apart from EACH OTHER\n")
line("direct -> order-1", "each other", ratio(hex("#FFD07A"), hex("#9E6726")), 3)

// order-1 -> order-2 cannot also reach 3:1 (see above), so what IS asserted is
// that the two are separable at all and that order-2's border does the work.
console.log("\norder-1 -> order-2 fill — bounded, plus its border carries 3:1\n")
line("order-1 -> order-2 fill", "each other", ratio(hex("#9E6726"), hex("#2E2718")), 1.6)

// ══════════════════════════════════════════════════════════════════════
// Map marks vs the dark_all basemap.
// ══════════════════════════════════════════════════════════════════════

// Sampled from a `dark_all` land tile AFTER --ae-basemap-paper is applied.
// Measuring against the raw tile would flatter every mark, because the filter
// lifts the basemap ~6% — so the gate would pass values that fail on screen.
// BOTH REGISTERS ARE GATED. Light mode ships a full second palette
// (`MAP_LIGHT` in flight-map.tsx); leaving it ungated would mean the one theme
// the gate does not check is the one free to drift. This block already had a
// stale `ambient ADS-B` value the map had moved past — exactly that failure,
// caught by writing the second half.
const BASEMAPS = {
  dark:  { tile: "#1A1D24", cancelledFill: "#39404E" },
  light: { tile: "#FBF8F3", cancelledFill: "#C9CCC9" },
}
const MARKS = {
  dark: {
    "airport hub":        "#5EE0C6",
    "airport focus city": "#33B49B",
    "airport spoke":      "#34A08C",
    // Operating = blue, cancelled = neutral. Grey must stay unique to
    // cancelled, so both flying tiers live in the blue family.
    "flight operating":   "#4FA3E3",
    "ambient ADS-B":      "#3F6E93",
    // Cancelled is a dim disc with a BRIGHT dashed border and bright glyph.
    // As with the ramp's pale step, the border is the figure — testing the
    // fill would fail a mark that is in fact conformant and "fix" it by
    // making cancelled loud again.
    "flight cancelled (border)": "#D5DAE6",
  },
  light: {
    "airport hub":        "#0B4F47",
    "airport focus city": "#2F6D63",
    "airport spoke":      "#3D6B60",
    "flight operating":   "#1C6FA8",
    "ambient ADS-B":      "#6E93B0",
    "flight cancelled (border)": "#333935",
  },
}

for (const [theme, marks] of Object.entries(MARKS)) {
  const { tile, cancelledFill } = BASEMAPS[theme]
  console.log(`\n\n══ map marks vs ${theme}_all basemap ${tile} ══\n`)
  for (const [name, color] of Object.entries(marks)) {
    line(name, "basemap", ratio(hex(color), hex(tile)), name === "ambient ADS-B" ? 1 : 3)
  }
  // The bug that hid 11 airports: spoke vs ambient traffic were 1.36:1 apart.
  line("spoke vs ambient", "each other", ratio(hex(marks["airport spoke"]), hex(marks["ambient ADS-B"])), 1.5)
  // Operating vs cancelled carries the most consequential distinction on the
  // map, so it is asserted rather than left to whoever edits the palette next.
  line("operating vs cancelled fill", "each other", ratio(hex(marks["flight operating"]), hex(cancelledFill)), 1.6)
}

// design.md: "Operating stays LIGHTER than cascade-direct so a nominal flight
// can never out-weigh a disrupted one." That is an ORDERING, not a ratio, and
// it was previously only prose — so re-inking either pigment could silently
// invert the map's weight hierarchy while every ratio above still passed.
//
// The comparison is on raw LUMINANCE, not on contrast-vs-basemap, because a
// ratio form would reward whichever mark is further from the tile in EITHER
// direction — and the direction is the whole assertion.
//
// Which direction counts as "out-weighs" FLIPS with the register: on the dark
// chart the disrupted mark must be brighter than the nominal one; on paper it
// must be darker. Getting that backwards would pass a map whose severity
// encoding is inverted, so both are checked explicitly.
console.log("")
for (const [theme, marks] of Object.entries(MARKS)) {
  const directHex = theme === "light" ? "#3A2408" : "#FFD07A"
  const direct = luminance(hex(directHex))
  const operating = luminance(hex(marks["flight operating"]))
  const ok = theme === "light" ? direct < operating : direct > operating
  if (!ok) failed++
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${theme}: cascade-direct out-weighs operating blue  ` +
      `(L ${direct.toFixed(3)} ${theme === "light" ? "<" : ">"} ${operating.toFixed(3)})`,
  )
}

console.log(failed ? `\n${failed} failing pair(s)\n` : "\nAll pairs pass.\n")
process.exit(failed ? 1 : 0)
