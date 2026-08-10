/**
 * Orthographic globe math — shared by the landing's `GlobePlate` and the
 * simulator's `GlobeView`.
 *
 * These four functions were written once for the landing globe. The simulator
 * globe needs exactly the same projection, the same great-circle interpolation
 * and the same coastline rings, and DESIGN.md's Components rule is explicit
 * that this system's drift has come from re-implementing rather than from
 * gaps — the cascade ramp already went a full severity order out of step when
 * two files each kept their own copy of "the same" colours under a comment
 * claiming they matched. So there is one copy of the geometry, imported twice.
 *
 * Everything here is pure and has no DOM dependency except `loadCoastlineRings`,
 * which fetches once per page and memoises the promise.
 */

export const DEG = Math.PI / 180

export type Vec3 = { x: number; y: number; z: number }

/** Lat/lon in degrees → a unit vector on the sphere. */
export function toVector(lat: number, lon: number): Vec3 {
  const phi = lat * DEG
  const lambda = lon * DEG
  const cosPhi = Math.cos(phi)
  return {
    x: cosPhi * Math.cos(lambda),
    y: Math.sin(phi),
    z: cosPhi * Math.sin(lambda),
  }
}

/** Great-circle interpolation, so a leg follows the route a jet would fly. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z
  dot = dot < -1 ? -1 : dot > 1 ? 1 : dot
  const omega = Math.acos(dot)
  if (omega < 1e-6) return a
  const sinOmega = Math.sin(omega)
  const wa = Math.sin((1 - t) * omega) / sinOmega
  const wb = Math.sin(t * omega) / sinOmega
  return {
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
  }
}

export type Projected = { x: number; y: number; depth: number }

/**
 * Rotate a unit vector into view space and project it orthographically.
 * Returns screen offsets in disc-radius units plus the depth term; depth < 0
 * means the point is on the far side and must not be drawn.
 */
export function makeProjector(lat0: number, lon0: number): (v: Vec3) => Projected {
  const cosLat = Math.cos(lat0 * DEG)
  const sinLat = Math.sin(lat0 * DEG)
  const cosLon = Math.cos(-lon0 * DEG)
  const sinLon = Math.sin(-lon0 * DEG)
  return (v: Vec3) => {
    // Yaw about the polar axis so `lon0` faces the camera. This yields three
    // axes and it matters which is which: `along` points at the viewer, `side`
    // is screen-horizontal, `up` is the polar direction. An earlier version
    // returned `along` as the screen x and used `side` as the depth — the two
    // swapped — so the globe faced 90° away from the requested longitude and
    // every projected mark landed outside the disc.
    const along = v.x * cosLon - v.z * sinLon // cosφ·cos(λ − lon0)
    const side = v.x * sinLon + v.z * cosLon // cosφ·sin(λ − lon0)
    const up = v.y

    // Then pitch by `lat0` about the screen-horizontal axis.
    return {
      x: side,
      y: up * cosLat - along * sinLat,
      depth: up * sinLat + along * cosLat,
    }
  }
}

export type Ring = Float32Array

let ringsPromise: Promise<Ring[]> | null = null

/** 273 coastline rings (10,468 points) from `public/data/world-coastline.json`. */
export function loadCoastlineRings(): Promise<Ring[]> {
  if (ringsPromise) return ringsPromise
  ringsPromise = fetch("/data/world-coastline.json")
    .then((response) => response.json())
    .then((payload: { rings: number[][] }) =>
      payload.rings.map((ring) => Float32Array.from(ring)),
    )
  return ringsPromise
}

/**
 * Screen-space heading of a leg at parameter `t`, in radians, ready to feed a
 * canvas `rotate()`.
 *
 * A plane glyph on a globe cannot use its geographic bearing: the sphere
 * rotates under it, so a due-east leg points a different way on screen at
 * every camera longitude. This samples the projected track just ahead of the
 * aircraft and takes the angle of the actual screen displacement, which stays
 * correct through rotation, tilt and the limb.
 */
export function screenHeading(
  project: (v: Vec3) => Projected,
  from: Vec3,
  to: Vec3,
  t: number,
): number {
  const eps = 0.012
  const a = project(slerp(from, to, Math.max(0, t - eps)))
  const b = project(slerp(from, to, Math.min(1, t + eps)))
  // Canvas y grows downward, so negate to keep "up on screen" = -y.
  return Math.atan2(-(b.y - a.y), b.x - a.x)
}
