import data from '../../data/stammtisch.json'

/** Distinct hues, readable on light and dark backgrounds. Order = participant order. */
const PALETTE = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ca8a04', // yellow
]

const colors = new Map(data.participants.map((p, i) => [p.name, PALETTE[i % PALETTE.length]!]))

/** Fixed colour per member, identical on every page and chart. */
export const memberColor = (name: string): string => colors.get(name) ?? '#71717a'
