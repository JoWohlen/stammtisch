import type { Coords, District, Ring } from '#shared/types'

/**
 * Minimal 2D geo helpers for the Cologne map (no d3 needed at city scale).
 * Projection: equirectangular, x scaled by cos(latitude) — distortion over Cologne's ~30 km is < 0.5 %.
 */

export interface Projection {
  width: number
  height: number
  project: (lng: number, lat: number) => [number, number]
}

/** fits all districts into a viewBox `width` wide, keeping the aspect ratio */
export function fitProjection(districts: District[], width: number, pad = 8): Projection {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const d of districts) {
    for (const poly of d.polygons) {
      for (const [lng, lat] of poly[0]!) {
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      }
    }
  }
  const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)
  const scale = (width - 2 * pad) / ((maxLng - minLng) * kx)
  const height = Math.ceil((maxLat - minLat) * scale + 2 * pad)
  const r1 = (n: number) => Math.round(n * 10) / 10
  return {
    width,
    height,
    project: (lng, lat) => [r1(pad + (lng - minLng) * kx * scale), r1(pad + (maxLat - lat) * scale)],
  }
}

/** SVG path for a district (use fill-rule="evenodd" so holes stay holes) */
export function districtPath(d: District, p: Projection): string {
  return d.polygons
    .flatMap(poly => poly.map(ring => `M${ring.map(([lng, lat]) => p.project(lng, lat).join(' ')).join('L')}Z`))
    .join('')
}

/** ray casting */
function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function contains(d: District, c: Coords): boolean {
  return d.polygons.some(([outer, ...holes]) =>
    inRing(c.lng, c.lat, outer!) && !holes.some(h => inRing(c.lng, c.lat, h)))
}

/** area-weighted centroid of the largest polygon, in projected coordinates (for labels) */
export function labelPoint(d: District, p: Projection): [number, number] {
  let best: [number, number] = [0, 0]
  let bestArea = 0
  for (const [outer] of d.polygons) {
    const pts = outer!.map(([lng, lat]) => p.project(lng, lat))
    let a = 0
    let cx = 0
    let cy = 0
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x0, y0] = pts[j]!
      const [x1, y1] = pts[i]!
      const f = x0 * y1 - x1 * y0
      a += f
      cx += (x0 + x1) * f
      cy += (y0 + y1) * f
    }
    if (Math.abs(a) > bestArea) {
      bestArea = Math.abs(a)
      best = [cx / (3 * a), cy / (3 * a)]
    }
  }
  return best
}

/** great-circle distance in meters (haversine) */
export function distance(a: Coords, b: Coords): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
