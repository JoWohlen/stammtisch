/**
 * Pixel-art Kölsch bottle for the drunk easter egg (DrunkEasterEgg.vue): a 0.5 l NRW bottle (about 1 : 4)
 * in amber glass with a green neck label, a gold band and a green body label between gold bands,
 * in the style of the Gilden bottle (a drawing after it, not its artwork). Round shading is baked into
 * the pixel columns. Plus the cap on its own (so it can fly off).
 *
 * Everything is a list of horizontal runs { x, y, w, c } on a grid, drawn as <rect>s with crisp edges.
 */

export interface Run { x: number, y: number, w: number, c: string }

/** the bottle's grid; the cap sits in rows 0–3 */
export const BEER_W = 24
export const BEER_H = 100

/** shades from the dark edge over a highlight to the other dark edge: [edge, dark, mid, light, highlight] */
const GLASS = ['#3a2002', '#7a4a06', '#b8770f', '#e3a737', '#f7d27a']
const AIR = ['#241401', '#3d2303', '#523004', '#6e4206', '#b07c30']
const GREEN = ['#06301a', '#0b5a30', '#11713d', '#279657', '#6fd19a']
const GOLD = ['#5e440c', '#9c751b', '#d1a63a', '#efcd6b', '#fff0b3']
const WHITE = '#f4f4f0'
const CREAM = '#f3dfa0'
const RED = '#b3261e'

/** column t (0 = left edge … 1 = right edge) → shade index; light comes from the front left */
function shadeAt(t: number): number {
  if (t < 0.1) return 0
  if (t < 0.22) return 1
  if (t < 0.3) return 2
  if (t < 0.4) return 4
  if (t < 0.48) return 3
  if (t < 0.72) return 2
  if (t < 0.88) return 1
  return 0
}

/** a grid of colours, merged into runs */
function toRuns(grid: (string | null)[][]): Run[] {
  const runs: Run[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (!c) {
        x++
        continue
      }
      let w = 1
      while (row[x + w] === c) w++
      runs.push({ x, y, w, c })
      x += w
    }
  })
  return runs
}

const blank = (w: number, h: number) => Array.from({ length: h }, () => Array<string | null>(w).fill(null))

/** width of the bottle in each row (centred), 0 = nothing */
function widthAt(y: number): number {
  if (y < 4) return 0 // cap
  if (y < 6) return 12 // lip
  if (y < 33) return 10 // neck
  if (y < 47) return [10, 12, 12, 14, 14, 16, 18, 18, 20, 20, 22, 22, 24, 24][y - 33]! // shoulder
  if (y < 99) return 24
  return 22 // rounded bottom
}

/** the material of a row: glass, the labels and the gold bands */
function materialAt(y: number): string[] {
  if (y >= 6 && y < 10) return AIR // below the cap the bottle isn't filled
  if (y === 11 || y === 26) return GOLD // thin lines round the neck label
  if (y > 11 && y < 26) return GREEN
  if (y >= 27 && y <= 29) return GOLD // band below the neck label
  if (y === 64 || y === 65 || y === 89 || y === 90) return GOLD // bands of the body label
  if (y > 65 && y < 89) return GREEN
  return GLASS
}

/** 3 × 5 letters (and the 1-wide ones), X = pixel */
const GLYPHS: Record<string, string[]> = {
  G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
  i: ['X', '.', 'X', 'X', 'X'],
  l: ['X', 'X', 'X', 'X', 'X'],
  d: ['..X', '..X', 'XXX', 'X.X', 'XXX'],
  e: ['XXX', 'X..', 'XXX', 'X..', 'XXX'],
  n: ['...', 'XX.', 'X.X', 'X.X', 'X.X'],
  K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  ö: ['X.X', '...', 'XXX', 'X.X', 'XXX'],
  s: ['.XX', 'X..', 'XXX', '..X', 'XX.'],
  c: ['...', 'XXX', 'X..', 'X..', 'XXX'],
  h: ['X..', 'X..', 'XXX', 'X.X', 'X.X'],
}

/** writes a word centred on the grid's middle, 1 px between letters */
function write(grid: (string | null)[][], word: string, y: number, color: string) {
  const glyphs = [...word].map(ch => GLYPHS[ch]!)
  const width = glyphs.reduce((sum, g) => sum + g[0]!.length, 0) + glyphs.length - 1
  let x = Math.floor((BEER_W - width) / 2)
  for (const g of glyphs) {
    g.forEach((row, dy) => [...row].forEach((p, dx) => {
      if (p === 'X') grid[y + dy]![x + dx] = color
    }))
    x += g[0]!.length + 1
  }
}

/** pixels drawn on top: [x, y, colour] patterns */
function stamp(grid: (string | null)[][], rows: string[], x0: number, y0: number, colors: Record<string, string>) {
  rows.forEach((row, dy) => [...row].forEach((p, dx) => {
    if (colors[p]) grid[y0 + dy]![x0 + dx] = colors[p]!
  }))
}

/** condensation on the glass: [x, y] */
const DROPS: [number, number][] = [
  [5, 38], [15, 41], [8, 50], [18, 53], [4, 57], [12, 60], [20, 47], [6, 94], [14, 92], [19, 96], [10, 97], [14, 35], [9, 31],
]

export function bottleRuns(): Run[] {
  const grid = blank(BEER_W, BEER_H)
  for (let y = 0; y < BEER_H; y++) {
    const w = widthAt(y)
    if (!w) continue
    const x0 = (BEER_W - w) / 2
    const mat = materialAt(y)
    for (let i = 0; i < w; i++) grid[y]![x0 + i] = mat[shadeAt(i / (w - 1))]!
  }
  // neck label: a small gold crown; body label: emblem, "Gilden", "Kölsch"
  stamp(grid, ['X.X.X', 'XXXXX'], 10, 15, { X: GOLD[3]! })
  stamp(grid, ['XXX', '.X.'], 11, 19, { X: CREAM })
  stamp(grid, ['X.X.X', 'XXXXX', 'XRRRX', 'XRRRX', '.XXX.'], 10, 68, { X: GOLD[3]!, R: RED })
  write(grid, 'Gilden', 75, WHITE)
  write(grid, 'Kölsch', 82, CREAM)
  for (const [x, y] of DROPS) if (grid[y]![x]) grid[y]![x] = 'rgb(255 255 255 / 0.45)'
  return toRuns(grid)
}

/** the crown cap in rows 0–3 of the bottle's grid */
export function capRuns(): Run[] {
  const grid = blank(BEER_W, BEER_H)
  const rows = [' xxxxxxxxxx ', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'x.x.x.x.x.x.']
  rows.forEach((row, y) => [...row].forEach((p, i) => {
    if (p === 'x') grid[y]![6 + i] = GOLD[shadeAt(i / 11)]!
  }))
  return toRuns(grid)
}
