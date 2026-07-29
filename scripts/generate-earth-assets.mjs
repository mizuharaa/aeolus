/**
 * Rebuilds the landing globe's equirectangular texture set.
 *
 * Run from the repository root:
 *   node scripts/generate-earth-assets.mjs
 *
 * Borders are rasterized into the same 2:1 UV space as the NASA albedo.
 * Keeping projection and dimensions identical removes the possibility of a
 * hand-tuned longitude offset drifting away from the coastline.
 */

import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const webRoot = resolve(root, "apps", "web")
const outputRoot = resolve(webRoot, "public", "textures")
const geoJsonPath = resolve(
  webRoot,
  "public",
  "data",
  "ne-110m-admin-0-countries.json",
)
const requireFromWeb = createRequire(resolve(webRoot, "package.json"))
const sharp = requireFromWeb("sharp")

const WIDTH = 4096
const HEIGHT = 2048
const CLOUD_WIDTH = 2048
const CLOUD_HEIGHT = 1024

const sources = {
  albedo:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
  night:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg",
  clouds:
    "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png",
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function checksum(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16)
}

function toProjectedPoint([lon, lat]) {
  return [
    ((lon + 180) / 360) * WIDTH,
    ((90 - lat) / 180) * HEIGHT,
  ]
}

function appendLineRingPath(ring) {
  let path = ""
  let previous = null
  for (const coordinate of ring) {
    const [lon] = coordinate
    const [x, y] = toProjectedPoint(coordinate)
    const startsSegment =
      previous === null || Math.abs(lon - previous[0]) > 180
    path += `${startsSegment ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    previous = coordinate
  }
  return path
}

function appendFilledRingPath(ring) {
  if (!ring.length) return ""
  let previousLongitude = ring[0][0]
  let unwrappedLongitude = previousLongitude
  let path = ""

  ring.forEach(([longitude, latitude], index) => {
    let delta = longitude - previousLongitude
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    if (index > 0) unwrappedLongitude += delta
    const x = ((unwrappedLongitude + 180) / 360) * WIDTH
    const y = ((90 - latitude) / 180) * HEIGHT
    path += `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    previousLongitude = longitude
  })

  return `${path}Z`
}

async function buildMapOverlays() {
  const collection = JSON.parse(await readFile(geoJsonPath, "utf8"))
  const borderPaths = []
  const landPaths = []
  for (const feature of collection.features) {
    const geometry = feature.geometry
    if (!geometry) continue
    if (geometry.type === "Polygon") {
      geometry.coordinates.forEach((ring) => {
        borderPaths.push(appendLineRingPath(ring))
        landPaths.push(appendFilledRingPath(ring))
      })
    } else if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((polygon) =>
        polygon.forEach((ring) => {
          borderPaths.push(appendLineRingPath(ring))
          landPaths.push(appendFilledRingPath(ring))
        }),
      )
    }
  }

  const bordersSvg = Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg">
      <path d="${borderPaths.join("")}" fill="none" stroke="#E8A33D"
        stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"
        stroke-opacity="0.78" />
    </svg>
  `)

  await sharp(bordersSvg)
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(outputRoot, "earth-borders.png"))

  const joinedLandPaths = landPaths.join("")
  const waterSvg = Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#fff" />
      <g fill="#000" fill-rule="evenodd">
        <path d="${joinedLandPaths}" />
        <path d="${joinedLandPaths}" transform="translate(${-WIDTH} 0)" />
        <path d="${joinedLandPaths}" transform="translate(${WIDTH} 0)" />
      </g>
    </svg>
  `)

  await sharp(waterSvg)
    .blur(0.55)
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(outputRoot, "earth-water-mask.png"))

  await sharp(waterSvg)
    .blur(0.55)
    .negate()
    .linear(0.82, 46)
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(outputRoot, "earth-roughness.png"))
}

async function main() {
  const [albedoSource, nightSource, cloudSource] = await Promise.all([
    download(sources.albedo),
    download(sources.night),
    download(sources.clouds),
  ])

  await sharp(albedoSource)
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .removeAlpha()
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(resolve(outputRoot, "earth-blue-marble.jpg"))

  await sharp(nightSource)
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .greyscale()
    .linear(1.35, -8)
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(outputRoot, "earth-night-lights.png"))

  await sharp(cloudSource)
    .resize(CLOUD_WIDTH, CLOUD_HEIGHT, { fit: "fill" })
    .ensureAlpha()
    .extractChannel("alpha")
    .linear(1.18, -10)
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(outputRoot, "earth-clouds.png"))

  await buildMapOverlays()

  const manifest = {
    projection: "equirectangular",
    dimensions: { width: WIDTH, height: HEIGHT },
    sources,
    sourceChecksums: {
      albedo: checksum(albedoSource),
      night: checksum(nightSource),
      clouds: checksum(cloudSource),
    },
    validation: {
      greenwich: { lon: 0, lat: 51.4779, pixel: toProjectedPoint([0, 51.4779]) },
      datelineEquator: { lon: 180, lat: 0, pixel: toProjectedPoint([180, 0]) },
      beringStrait: {
        lon: -168.9,
        lat: 65.8,
        pixel: toProjectedPoint([-168.9, 65.8]),
      },
    },
  }
  await writeFile(
    resolve(outputRoot, "earth-assets.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  console.log(
    `Generated Earth textures at ${WIDTH}x${HEIGHT}; borders share the exact albedo UV projection.`,
  )
}

await main()
