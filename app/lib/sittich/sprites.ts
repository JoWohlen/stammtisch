/**
 * Pixel sprites for the Halsbandsittich easter egg. Each string is one row, each character one pixel
 * (see PAL for the colours, '.' is transparent). Every sprite faces left; the engine mirrors it.
 */

export type Sprite = string[]
export type Palette = Record<string, string>

export const PAL: Palette = {
  o: '#1e3d17', // outline
  L: '#9be35a', G: '#6cc93a', D: '#469a2c', W: '#357a22', // light → dark green
  R: '#e0353d', r: '#8e1f28', // beak
  E: '#121212', w: '#ffffff', Y: '#f0a234', // eye, highlight, eye ring
  B: '#151515', P: '#e88aa8', N: '#6db8a6', // neck ring black/pink, bluish nape
  T: '#4f9e86', t: '#8fc77a', y: '#c8dc6a', // tail, tail highlight, tail tip
  F: '#a6969a', // feet
}

/** females (and young birds) have no neck ring */
export const FEMALE: Palette = { ...PAL, B: PAL.G!, P: PAL.G! }

/** eyes shut: the eye pixels take the head colour */
export const closedEyes = (pal: Palette): Palette => ({ ...pal, E: pal.L!, w: pal.L! })

/** sitting, 22 × 50; row WIRE_ROW holds the toes that wrap over the wire */
export const SPRITE: Sprite = [
  '.......oooo',
  '.....ooLLLLoo',
  '....oLLLLLLGGo',
  '...oLLLLLLGGGGo',
  '..oRoLLYYLGGGNo',
  '.oRRoLYEEYGGGNNo',
  'oRRRRoYEwYGGGGNo',
  'oRRRroLYYLGGGGGo',
  '.oRrroLLGGGGGPPo',
  '..ooooLGGGGPPBBo',
  '....oLGGGPBBBBGo',
  '....oLGBBBBGGGDDo',
  '....oLBBGGGGDDWDo',
  '....oLLGGGDDWWWDo',
  '....oLLGGGDWWDWWDo',
  '....oLLLGGDWDWWWDo',
  '....oLLLGGDWWDWWDo',
  '....oLLLGGDWDWWWDo',
  '....oLLLGGDWWDWWDo',
  '.....oLLGGDWDWWWDo',
  '.....oLLGGDDWWDWWo',
  '.....oLLGGGDWWWDWo',
  '......oLGGGDDWWWDo',
  '......ooFFoFFoDWWo',
  '.......FF..FF.oWTo',
  '.............otWWo',
  '.............oTtWo',
  '.............oTTto',
  '.............otTTo',
  '.............oTtTo',
  '.............oTTto',
  '.............otTTo',
  '.............oTtTo',
  '.............oTTto',
  '..............oTTo',
  '..............oTto',
  '..............otTo',
  '..............oTTo',
  '..............oTto',
  '..............otTo',
  '..............oTTo',
  '..............oTo',
  '..............oTo',
  '..............oTo',
  '..............oTo',
  '..............oTo',
  '..............oTo',
  '..............oyo',
  '..............oyo',
  '...............o',
]
export const WIRE_ROW = 24
export const SPRITE_W = 22
/** mirror axis between the two feet */
export const TOE_CX = 10

/** puts `top` over `base`; '.' and missing rows in `top` let `base` show through */
export const overlay = (base: Sprite, top: Sprite): Sprite => base.map((row, y) => {
  const t = top[y] ?? ''
  let out = ''
  for (let x = 0; x < Math.max(row.length, t.length); x++) out += t[x] && t[x] !== '.' ? t[x] : (row[x] ?? '.')
  return out
})

const empty = (n: number): Sprite => Array.from({ length: n }, () => '')

/** flying, body horizontal; the wings are laid over it per frame */
const FLY_BASE: Sprite = [
  ...empty(7),
  '.......oooo',
  '.....ooLLLLoo',
  '....oLLLLLLGGoooooo',
  '...oLLLLLLGGGGGGGGGoooo',
  '..oRoLLYYLGGGNGGGGGGGGGoo',
  '.oRRoLYEEYGGGNNGGGGGGGGGGooo',
  'oRRRRoYEwYGGGGNPBGGGGGGGGGDDoooooooo',
  'oRRRroLYYLGGGGPBGGGGGGGGGDDDTTTTttTTTooooo',
  '.oRrroLLGGGGPBLLLLLLLLGGGDDoTTtTTTTTTTTTyyo',
  '..ooooLGGGPBLLLLLLLLLLGGDoooooooTTTTTooooo',
  '.....oLBBLLLLLLLLLGGGooo.......ooooo',
  '......ooooooooooooooo',
  ...empty(5),
]
export const FLY_UP = overlay(FLY_BASE, [
  '..........................oooo',
  '.........................oWWWo',
  '........................oWWWDo',
  '.......................oWWWDDo',
  '......................oWWWDDGo',
  '.....................oWWWDDGo',
  '....................oWWDDDGo',
  '...................oWWDDGGo',
  '..................oWDDGGGo',
  '................ooDDGGGGo',
  '...............oDDGGGGo',
])
/** wing stretched straight back: the in-between frame of a wingbeat */
export const FLY_MID = overlay(FLY_BASE, [
  ...empty(8),
  '...................ooooooooo',
  '.................ooDDWWWWWWWoo',
  '................oGGDDDWWWWWWWWo',
  '................oGGGDDDDooooooo',
  '................ooooooo',
])
export const FLY_DOWN = overlay(FLY_BASE, [
  ...empty(13),
  '..................oGGGDDo',
  '..................oGGDDWWo',
  '..................oGDDWWWo',
  '...................oDDWWWo',
  '...................oDWWWo',
  '....................oWWWo',
  '....................oWWWo',
  '.....................oWWo',
  '.....................oWo',
  '......................oo',
])
/** where the flying body sits relative to the sitting one (sprite px), and the flying body's centre */
export const FLY_DX = 11 - 20
export const FLY_DY = 16 - 14
export const FLY_CENTER = [20, 14] as const

/** landing / take-off: sitting, wings raised */
export const LAND_UP = overlay(SPRITE, [
  '......................oo',
  '....................ooWWo',
  '..................ooWWWDo',
  '.................oWWWDDDo',
  '................oWWDDDGo',
  '................oWDDDGGo',
  '................oWDDGGo',
  '................oDDGGGo',
  '................oDGGGo',
  '................oDGGo',
  '...............oDGGo',
  '...............oGGo',
])
/** landing / take-off: sitting, wings spread back (half folded) */
export const LAND_SPREAD = overlay(SPRITE, [
  ...empty(10),
  '................ooooo',
  '...............oGGDWWoo',
  '...............oGDDWWWWoo',
  '...............oDDWWWWWWWo',
  '................oDWWWWWoo',
  '................ooooooo',
])

/** the sprite as an SVG string, `s` CSS px per pixel; `keep` filters which pixels are drawn */
export const svgOf = (rows: Sprite, pal: Palette, s: number, keep: (c: string, y: number, x: number) => boolean = () => true): string => {
  const w = Math.max(...rows.map(r => r.length))
  let out = ''
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.' || !pal[c] || !keep(c, y, x)) return
    out += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="${pal[c]}"/>`
  }))
  return `<svg width="${w * s}" height="${rows.length * s}" viewBox="0 0 ${w * s} ${rows.length * s}" shape-rendering="crispEdges" style="display:block">${out}</svg>`
}
