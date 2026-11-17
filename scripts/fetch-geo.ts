/**
 * Downloads the official district borders of Cologne (Stadtteile + Stadtbezirke) from the
 * city's geoportal, simplifies them and writes data/koeln-geo.json.
 *
 * Borders change rarely, so this is NOT part of the build — run it by hand (`pnpm fetch-geo`)
 * and commit the result. Source: Stadt Köln, Kleinräumige Gliederung (Datenlizenz Deutschland – Zero 2.0,
 * no attribution required).
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { District, KoelnGeo, Ring } from '../shared/types'

const root = fileURLToPath(new URL('..', import.meta.url))
const OUT = `${root}data/koeln-geo.json`
const BASE = 'https://geoportal.stadt-koeln.de/arcgis/rest/services/Basiskarten/kgg/MapServer'
const LAYER = { stadtteil: 3, stadtbezirk: 4 }

/** ~7 m — invisible at map scale, keeps the file small */
const TOLERANCE = 0.0001
const DIGITS = 5

type Geometry
  = | { type: 'Polygon', coordinates: Ring[] }
    | { type: 'MultiPolygon', coordinates: Ring[][] }

interface Feature {
  properties: Record<string, string | number | null>
  geometry: Geometry
}

async function fetchLayer(id: number): Promise<Feature[]> {
  const url = `${BASE}/${id}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const json = await res.json() as { features?: Feature[] }
  if (!json.features?.length) throw new Error(`${url} → no features`)
  return json.features
}

/** perpendicular distance of p to the segment a–b (in degrees, fine at this scale) */
function segDist(p: number[], a: number[], b: number[]): number {
  const [x, y] = p as [number, number]
  const [x1, y1] = a as [number, number]
  const [x2, y2] = b as [number, number]
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** Douglas–Peucker */
function simplify(pts: number[][]): number[][] {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let max = 0
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = segDist(pts[i]!, pts[s]!, pts[e]!)
      if (d > max) [max, idx] = [d, i]
    }
    if (idx >= 0 && max > TOLERANCE) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return pts.filter((_, i) => keep[i])
}

const round = (n: number) => Math.round(n * 10 ** DIGITS) / 10 ** DIGITS

function toPolygons(g: Geometry): Ring[][] {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys
    .map(rings => rings
      .map(r => simplify(r).map(([x, y]) => [round(x!), round(y!)] as [number, number]))
      .filter(r => r.length >= 4))
    .filter(rings => rings.length > 0)
}

async function main() {
  const [teile, bezirke] = await Promise.all([fetchLayer(LAYER.stadtteil), fetchLayer(LAYER.stadtbezirk)])

  const stadtteile: District[] = teile.map(f => ({
    nummer: String(f.properties.nummer),
    name: String(f.properties.name),
    stadtbezirk: String(f.properties.stadtbezirk),
    polygons: toPolygons(f.geometry),
  })).sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }))

  const stadtbezirke: District[] = bezirke.map(f => ({
    nummer: String(f.properties.nummer),
    name: String(f.properties.name),
    stadtbezirk: String(f.properties.name),
    polygons: toPolygons(f.geometry),
  })).sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }))

  const geo: KoelnGeo = { source: BASE, stadtteile, stadtbezirke }
  writeFileSync(OUT, `${JSON.stringify(geo)}\n`)
  console.log(`✔ ${stadtteile.length} Stadtteile, ${stadtbezirke.length} Stadtbezirke → data/koeln-geo.json`)
}

main()
