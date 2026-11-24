import data from '../../data/stammtisch.json'
import { MEMBER_PALETTE as PALETTE } from './member-palette'

const colors = new Map(data.participants.map((p, i) => [p.name, PALETTE[i % PALETTE.length]!]))

/** Fixed colour per member, identical on every page and chart. */
export const memberColor = (name: string): string => colors.get(name) ?? '#71717a'
