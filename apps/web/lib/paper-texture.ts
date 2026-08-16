/**
 * Paper grain — the tile that makes a canvas surface read as printed stock
 * rather than as a flat vector fill.
 *
 * Lifted out of `landing/globe-plate.tsx`, where the reason it exists is
 * already recorded: "The land was one flat fill, which is what made the globe
 * read as a wireframe diagram rather than as a printed chart — the rest of the
 * landing is paper stock and the one big object on the page had no surface at
 * all." The simulator globe shipped without it and had exactly that problem, on
 * a console whose entire register is paper.
 *
 * ── Why the cache is split in two ─────────────────────────────────────────
 * The landing version memoised the `CanvasPattern`. A CanvasPattern belongs to
 * the context that created it, so a single cached pattern cannot be shared by
 * two canvases — and with the simulator globe there are now two. What is
 * genuinely reusable is the TILE, which is just an offscreen canvas. So the
 * tile is built once per page and the pattern is derived per context, cached
 * against that context in a WeakMap.
 */

let tile: HTMLCanvasElement | null = null

/** The 128px noise-plus-fibre tile. Built once; context-independent. */
function grainTile(): HTMLCanvasElement | null {
  if (tile) return tile
  if (typeof document === "undefined") return null
  const t = document.createElement("canvas")
  t.width = 128
  t.height = 128
  const g = t.getContext("2d")
  if (!g) return null
  const image = g.createImageData(128, 128)
  // Deterministic LCG — a random() here would make the texture differ between
  // the server-rendered and client-rendered passes of any future SSR attempt.
  let seed = 1337
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  for (let y = 0; y < 128; y += 1) {
    const fibre = Math.sin(y * 0.7) * 5
    for (let x = 0; x < 128; x += 1) {
      const offset = (y * 128 + x) * 4
      const value = 150 + rand() * 74 + fibre
      image.data[offset] = value
      image.data[offset + 1] = value
      image.data[offset + 2] = value
      image.data[offset + 3] = 46
    }
  }
  g.putImageData(image, 0, 0)
  tile = t
  return tile
}

const perContext = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>()

/** A repeating paper-grain pattern valid for THIS context. */
export function paperGrain(context: CanvasRenderingContext2D): CanvasPattern | null {
  if (perContext.has(context)) return perContext.get(context) ?? null
  const t = grainTile()
  const pattern = t ? context.createPattern(t, "repeat") : null
  perContext.set(context, pattern)
  return pattern
}
