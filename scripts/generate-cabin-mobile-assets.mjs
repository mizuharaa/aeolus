/**
 * Builds the mobile cabin texture tier from the registered CC0 desktop maps.
 *
 * Run from the repository root:
 *   node scripts/generate-cabin-mobile-assets.mjs
 */

import { readdir } from "node:fs/promises"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const webRoot = resolve(root, "apps", "web")
const textureRoot = resolve(webRoot, "public", "textures", "cabin")
const requireFromWeb = createRequire(resolve(webRoot, "package.json"))
const sharp = requireFromWeb("sharp")

const sources = (await readdir(textureRoot)).filter(
  (name) => extname(name) === ".webp" && !name.endsWith("-mobile.webp"),
)

await Promise.all(
  sources.map(async (name) => {
    const source = resolve(textureRoot, name)
    const metadata = await sharp(source).metadata()
    const width = Math.max(256, Math.round((metadata.width ?? 1024) / 2))
    const height = Math.max(256, Math.round((metadata.height ?? 1024) / 2))
    const output = resolve(textureRoot, name.replace(/\.webp$/, "-mobile.webp"))
    await sharp(source)
      .resize(width, height, { fit: "fill" })
      .webp({ quality: 76, effort: 5 })
      .toFile(output)
  }),
)

console.log(`Generated ${sources.length} half-resolution cabin texture maps.`)
