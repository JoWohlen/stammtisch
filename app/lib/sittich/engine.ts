/**
 * Halsbandsittich easter egg: a parakeet (sometimes a pair) flies onto the menu bar's bottom line,
 * sits there, blinks, bobs, walks, turns and grooms. A click scares it off; on some
 * pages a click makes it explode instead. Plain DOM + canvas, no framework, so it can be torn down
 * completely by `destroy()`.
 */
import {
  closedEyes, FEMALE, FLY_CENTER, FLY_DOWN, FLY_DX, FLY_DY, FLY_MID, FLY_UP, LAND_SPREAD, LAND_UP,
  PAL, SPRITE, SPRITE_W, svgOf, TOE_CX, WIRE_ROW,
} from './sprites'
import type { Palette } from './sprites'

/** distance between the two birds' feet: beak tips just meet, leaning in reaches the neck (sprite px) */
const PAIR_GAP = 21
/** the menu bar's height: its bottom border is the "wire" */
const LINE_Y = 56

/** the "HAU AB!" stays this long; the bird takes off once it has popped up (pop + settle in its keyframes) */
const SHOUT_MS = 1800
const SHOUT_POP_MS = SHOUT_MS * 0.26

type Frame = 'perch' | 'up' | 'mid' | 'down' | 'lup' | 'lspread'

interface Bird {
  el: HTMLDivElement
  sc: number
  /** 1 = sprite as drawn (looking left), -1 = mirrored */
  mir: number
  x: number
  y: number
  minX: number
  maxX: number
  dead: boolean
  busy: boolean
  walking: boolean
  perched: boolean
  leaving: boolean
  charging: boolean
  partner?: Bird
  raf: number
  idle?: ReturnType<typeof setTimeout>
  q: (sel: string) => HTMLElement
  place: (x: number, y: number) => void
}

export interface SittichOptions {
  /** a click here sets off the explosion instead of scaring the bird away */
  isNukePage: () => boolean
  /** the bar holding the logo and the menu button (default: the perch's parent) */
  bar?: () => HTMLElement | null | undefined
}

export interface SittichScene {
  /** lands one bird, and with `pair` a female follows a little later */
  land: (pair: boolean) => void
  /** true while a bird is on screen (sitting, flying or exploding) */
  busy: () => boolean
  /** every bird takes off as if startled (also one still flying in; a charging one goes off anyway) */
  scareAll: () => void
  destroy: () => void
}

const bez = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d
const lerp = (p0: number[], p1: number[], t: number) => [p0[0]! + (p1[0]! - p0[0]!) * t, p0[1]! + (p1[1]! - p0[1]!) * t]
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const rnd = (a: number, z: number) => a + Math.random() * (z - a)
const ABS = 'position:absolute;left:0;top:0'

export function createSittichScene(perch: HTMLElement, opts: SittichOptions): SittichScene {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  let male: Bird | undefined
  let female: Bird | undefined
  const effects = new Set<() => void>() // running explosions, so destroy() can stop them

  // every timer goes through here, so a removed bird stops doing things
  const later = (b: Bird, fn: () => void, ms: number) => setTimeout(() => {
    if (!b.dead) fn()
  }, ms)

  /** free stretch of the line between the logo and the menu button */
  const bounds = (sc: number) => {
    const box = perch.getBoundingClientRect()
    const bar = opts.bar?.() ?? perch.parentElement
    const logo = bar?.querySelector('a')?.getBoundingClientRect()
    const button = bar?.querySelector('button')?.getBoundingClientRect()
    const min = (logo ? logo.right - box.left : 0) + 8
    const max = (button ? button.left - box.left : box.width) - SPRITE_W * sc - 8
    return max > min ? { min, max } : { min: 8, max: Math.max(8, box.width - SPRITE_W * sc - 8) }
  }

  function makeBird(sc: number, pal: Palette, mir: number): Bird {
    const blink = closedEyes(pal)
    const toe = (c: string, y: number) => y === WIRE_ROW && c === 'F'
    const el = document.createElement('div')
    el.style.cssText = `${ABS};pointer-events:none;z-index:1`
    el.innerHTML = `
      <div class="mir" style="${ABS};transform:scaleX(${mir});transform-origin:${TOE_CX * sc}px 0">
        <div class="perch" style="${ABS};transform-origin:${TOE_CX * sc}px 0">
          <div class="upper" style="${ABS};transition:transform 90ms;transform-origin:${TOE_CX * sc}px ${WIRE_ROW * sc}px">
            <div class="pbody" style="${ABS}">${svgOf(SPRITE, pal, sc, (c, y) => !toe(c, y))}</div>
            <div class="pblink" style="${ABS}" hidden>${svgOf(SPRITE, blink, sc, (c, y) => !toe(c, y))}</div>
          </div>
          <div class="tl" style="${ABS};transition:transform 90ms">${svgOf(SPRITE, pal, sc, (c, y, x) => toe(c, y) && x < TOE_CX)}</div>
          <div class="tr" style="${ABS};transition:transform 90ms">${svgOf(SPRITE, pal, sc, (c, y, x) => toe(c, y) && x >= TOE_CX)}</div>
        </div>
        <div class="lup" style="${ABS}" hidden>${svgOf(LAND_UP, pal, sc)}</div>
        <div class="lspread" style="${ABS}" hidden>${svgOf(LAND_SPREAD, pal, sc)}</div>
        <div class="fly" style="position:absolute;left:${FLY_DX * sc}px;top:${FLY_DY * sc}px;transform-origin:${FLY_CENTER[0] * sc}px ${FLY_CENTER[1] * sc}px">
          <div class="fup" style="${ABS}" hidden>${svgOf(FLY_UP, pal, sc)}</div>
          <div class="fmid" style="${ABS}" hidden>${svgOf(FLY_MID, pal, sc)}</div>
          <div class="fdown" style="${ABS}" hidden>${svgOf(FLY_DOWN, pal, sc)}</div>
        </div>
      </div>
      <div class="hit" style="${ABS};width:${SPRITE_W * sc}px;height:${WIRE_ROW * sc}px;pointer-events:auto;cursor:pointer" hidden></div>`
    perch.appendChild(el)
    const { min, max } = bounds(sc)
    const b: Bird = {
      el, sc, mir, x: 0, y: 0, minX: min, maxX: max,
      dead: false, busy: false, walking: false, perched: false, leaving: false, charging: false, raf: 0,
      q: sel => el.querySelector<HTMLElement>(sel)!,
      place: (x, y) => {
        b.x = x
        b.y = y
        el.style.transform = `translate(${x}px, ${y}px)`
      },
    }
    b.q('.hit').addEventListener('click', () => {
      if (opts.isNukePage()) return nuke(b)
      if (b.leaving) return // already shouted at
      // first the shout pops up, then the bird takes off while it is still there
      shout(b)
      scare(b, SHOUT_POP_MS)
    })
    return b
  }

  const vanish = (b?: Bird) => {
    if (!b) return
    b.dead = true
    cancelAnimationFrame(b.raf)
    b.el.remove()
  }

  function show(b: Bird, frame: Frame) {
    const frames: [string, Frame][] = [['.perch', 'perch'], ['.fup', 'up'], ['.fdown', 'down'], ['.fmid', 'mid'], ['.lup', 'lup'], ['.lspread', 'lspread']]
    for (const [sel, f] of frames) b.q(sel).hidden = frame !== f
    b.perched = frame === 'perch'
    b.q('.hit').hidden = !b.perched
  }

  // facing on screen: -1 = looking left, 1 = looking right
  const turned = (b: Bird) => !!b.q('.perch').style.transform
  const facing = (b: Bird) => -b.mir * (turned(b) ? -1 : 1)
  const setFacing = (b: Bird, dir: number) => {
    b.q('.perch').style.transform = dir * b.mir === 1 ? 'scaleX(-1)' : ''
  }
  const setUpper = (b: Bird, t: string) => {
    b.q('.upper').style.transform = t
  }

  // ---------- landing ----------
  // stages (ms):
  //  1 flap in      1300  4-frame wingbeat (up, mid, down, mid) along a descending arc
  //  2 glide         320  wings held out, sinking towards the spot
  //  3 flare         240  wings up, body pitches nose-up to brake
  //  4 back-flap     600  upright landing pose, slowing wingbeats, dropping onto the line
  //  5 touchdown     260  wings half folded, body sinks into the wire
  //  6 settle       ~900  two bobs, then a feather shake
  // the bird always arrives from behind, so a mirrored bird comes in from the left
  function flyIn(b: Bird, tx: number, ty: number, done: () => void) {
    const sc = b.sc, m = b.mir
    // start just outside the window (the bar itself is narrower than the window on wide screens)
    const box = perch.getBoundingClientRect()
    const sx = m > 0 ? window.innerWidth - box.left + 30 : -box.left - SPRITE_W * sc - 30, sy = -30 * sc
    const g1 = [tx + m * 42 * sc, ty - 24 * sc], g2 = [tx + m * 24 * sc, ty - 17 * sc], a = [tx + m * 12 * sc, ty - 14 * sc]
    const c1 = [sx - (sx - g1[0]!) * 0.35, sy + 10 * sc], c2 = [g1[0]! + m * 30 * sc, g1[1]! - 8 * sc]
    const D = [1300, 320, 240, 600]
    const T = D.reduce((acc, d) => [...acc, acc[acc.length - 1]! + d], [0])
    const flyEl = b.q('.fly')
    const beat: Frame[] = ['up', 'mid', 'down', 'mid']
    const t0 = performance.now()
    const step = (now: number) => {
      if (b.dead) return
      const e = now - t0
      let pos: number[]
      if (e < T[1]!) {
        const t = easeInOut(e / D[0]!)
        pos = [bez(sx, c1[0]!, c2[0]!, g1[0]!, t), bez(sy, c1[1]!, c2[1]!, g1[1]!, t)]
        show(b, beat[Math.floor(e / 70) % 4]!)
        flyEl.style.transform = `rotate(${-6 * Math.sin(e / 140)}deg)` // slight rocking with the wingbeat
      }
      else if (e < T[2]!) {
        const t = (e - T[1]!) / D[1]!
        pos = lerp(g1, g2, t)
        show(b, 'mid')
        flyEl.style.transform = `rotate(${8 * t}deg)`
      }
      else if (e < T[3]!) {
        const t = (e - T[2]!) / D[2]!
        pos = lerp(g2, a, 1 - (1 - t) ** 2)
        show(b, 'up')
        flyEl.style.transform = `rotate(${8 + 30 * t}deg)`
      }
      else if (e < T[4]!) {
        const p = (e - T[3]!) / D[3]!
        pos = lerp(a, [tx, ty], 1 - (1 - p) ** 2.5)
        const rate = p < 0.4 ? 90 : p < 0.75 ? 140 : Infinity
        show(b, rate === Infinity ? 'lup' : (Math.floor((e - T[3]!) / rate) % 2 ? 'lspread' : 'lup'))
      }
      else {
        b.place(tx, ty)
        flyEl.style.transform = ''
        show(b, 'lspread')
        later(b, () => {
          show(b, 'perch')
          setUpper(b, `translateY(${sc}px)`) // sinks in
          later(b, () => {
            setUpper(b, '')
            later(b, () => {
              bob(b, 2)
              later(b, () => {
                shake(b)
                later(b, done, 400)
              }, 700)
            }, 160)
          }, 140)
        }, 120)
        return
      }
      b.place(pos[0]!, pos[1]!)
      b.raf = requestAnimationFrame(step)
    }
    b.raf = requestAnimationFrame(step)
  }

  // ---------- sitting ----------
  function shake(b: Bird) {
    [1, -1, 1, -1, 0].forEach((d, i) => later(b, () => setUpper(b, d ? `translateX(${d * b.sc}px)` : ''), i * 70))
  }

  function bob(b: Bird, times: number) {
    let i = 0
    const go = () => {
      setUpper(b, `translateY(${b.sc}px)`)
      later(b, () => {
        setUpper(b, '')
        if (++i < times) later(b, go, 140)
      }, 130)
    }
    go()
  }

  const eyesShut = (b: Bird, shut: boolean) => {
    b.q('.pblink').hidden = !shut
    b.q('.pbody').style.visibility = shut ? 'hidden' : ''
  }
  function blink(b: Bird) {
    eyesShut(b, true)
    later(b, () => eyesShut(b, false), 140)
  }

  function idle(b: Bird) {
    if (reduceMotion || b.dead) return
    clearTimeout(b.idle)
    b.idle = later(b, () => {
      if (b.busy) return idle(b)
      const r = Math.random()
      const p = b.partner
      if (p) { // a couple stays put, but doesn't groom all the time
        const free = !p.busy && p.perched && !p.dead
        if (r < 0.2 && free) return groom(b, p)
        if (r < 0.35 && free) { // both look the same way
          const dir = Math.random() < 0.5 ? -1 : 1
          setFacing(b, dir)
          later(p, () => {
            if (!p.busy) setFacing(p, dir)
          }, 300 + Math.random() * 500)
        }
        else if (r < 0.55) setFacing(b, -facing(b)) // turn on its own: away from, or back to, the partner
        else if (r < 0.85) blink(b)
        else bob(b, 1)
      }
      else if (r < 0.45) blink(b)
      else if (r < 0.6) bob(b, 1 + (Math.random() < 0.5 ? 1 : 0))
      else if (r < 0.85) return walk(b)
      else setFacing(b, -facing(b)) // turn around on the wire
      idle(b)
    }, 1800 + Math.random() * 3200)
  }

  // sidestep: one foot lifts, body bobs, bird shifts 3 sprite px per step; mostly to the right
  function walk(b: Bird) {
    const stepPx = 3 * b.sc
    let dir = 1
    if (b.x + stepPx * 3 > b.maxX) dir = -1
    else if (b.x - stepPx * 3 >= b.minX && Math.random() < 0.25) dir = -1
    const room = dir > 0 ? b.maxX - b.x : b.x - b.minX
    const steps = Math.min(Math.floor(room / stepPx), 3 + Math.floor(Math.random() * 6))
    if (steps < 1) return idle(b)
    b.busy = b.walking = true
    // lead with the foot on the side we walk towards
    const lead = (dir * b.mir > 0) !== turned(b) ? '.tr' : '.tl'
    const trail = lead === '.tr' ? '.tl' : '.tr'
    let i = 0
    const step = () => {
      const foot = b.q(i % 2 ? trail : lead)
      foot.style.transform = `translateY(${-b.sc}px)`
      setUpper(b, `translateY(${-b.sc}px)`)
      later(b, () => {
        b.place(b.x + dir * stepPx / 2, b.y)
        later(b, () => {
          foot.style.transform = ''
          setUpper(b, '')
          b.place(b.x + dir * stepPx / 2, b.y)
          if (++i < steps) later(b, step, 120)
          else {
            b.busy = b.walking = false
            idle(b)
          }
        }, 110)
      }, 110)
    }
    step()
  }

  // grooming: the groomer leans in and nibbles the partner's neck; the partner closes its eyes and tilts towards it
  function groom(g: Bird, r: Bird) {
    g.busy = r.busy = true
    setFacing(g, Math.sign(r.x - g.x))
    setFacing(r, Math.sign(g.x - r.x))
    setUpper(g, 'rotate(-14deg)') // lean forward (local "forward" is left)
    later(g, () => {
      setUpper(r, 'rotate(5deg)')
      eyesShut(r, true)
      const nibbles = 6 + Math.floor(Math.random() * 5)
      let i = 0
      const nib = () => {
        setUpper(g, i % 2 ? 'rotate(-14deg)' : 'rotate(-18deg)')
        if (++i < nibbles) return void later(g, nib, 140)
        later(g, () => {
          setUpper(g, '')
          setUpper(r, '')
          eyesShut(r, false)
          g.busy = r.busy = false
          later(r, () => bob(r, 1), 250) // happy little bob afterwards
          idle(g)
          idle(r)
        }, 140)
      }
      nib()
    }, 220)
  }

  // ---------- second bird ----------
  function addFemale() {
    const m = male
    if (!m || m.dead || female) return
    if (m.walking || !m.perched) return void later(m, addFemale, 400)
    const gap = PAIR_GAP * m.sc
    const side = m.x - gap >= m.minX ? -1 : 1 // land on the left if there's room
    if (side > 0 && m.x + gap > m.maxX) return // no room on either side
    const f = female = makeBird(m.sc, FEMALE, side < 0 ? -1 : 1)
    m.partner = f
    f.partner = m
    m.busy = true // stays put and looks at her while she comes in
    setFacing(m, side)
    const tx = m.x + side * gap
    if (reduceMotion) {
      f.place(tx, m.y)
      show(f, 'perch')
      m.busy = false
      return
    }
    f.busy = true
    flyIn(f, tx, m.y, () => {
      if (m.dead) return flyAway(f, 300) // he was scared off while she was on her way
      m.busy = f.busy = false
      groom(m, f)
    })
  }

  // ---------- leaving ----------
  // take-off: crouch, hop up with wings raised, then flap away up and out in the direction it's looking
  function flyAway(b: Bird, delay = 0) {
    if (b.leaving || b.charging) return
    b.leaving = true
    b.dead = true // stops idle, walking and grooming timers
    cancelAnimationFrame(b.raf)
    if (reduceMotion) return void b.el.remove()
    setTimeout(() => {
      if (!b.el.isConnected) return
      const sc = b.sc
      // if it had turned around, flip the whole bird instead so the flying frames face the same way
      if (turned(b)) {
        b.mir = -b.mir
        b.q('.mir').style.transform = `scaleX(${b.mir})`
        b.q('.perch').style.transform = ''
      }
      const dir = -b.mir
      setUpper(b, `translateY(${sc}px)`) // crouch
      setTimeout(() => {
        if (!b.el.isConnected) return
        setUpper(b, '')
        show(b, 'lup')
        b.q('.hit').hidden = true
        const x0 = b.x, y0 = b.y, hop = [x0 + dir * 4 * sc, y0 - 8 * sc]
        const box = perch.getBoundingClientRect()
        const exitX = dir < 0 ? -box.left - SPRITE_W * sc * 3 : window.innerWidth - box.left + SPRITE_W * sc
        const exitY = -45 * sc
        const flyEl = b.q('.fly')
        const t0 = performance.now()
        const step = (now: number) => {
          if (!b.el.isConnected) return
          const e = now - t0
          if (e < 130) { // hop
            const t = e / 130
            b.place(x0 + (hop[0]! - x0) * t, y0 + (hop[1]! - y0) * t)
            show(b, t < 0.5 ? 'lup' : 'lspread')
          }
          else { // flap away, accelerating
            const t = Math.min((e - 130) / 1100, 1), te = t * t
            b.place(bez(hop[0]!, hop[0]! + dir * 10 * sc, exitX - dir * 40 * sc, exitX, te),
              bez(hop[1]!, hop[1]! - 12 * sc, exitY + 10 * sc, exitY, te))
            show(b, (['up', 'mid', 'down', 'mid'] as Frame[])[Math.floor(e / 60) % 4]!)
            b.q('.hit').hidden = true
            flyEl.style.transform = `rotate(${20 * (1 - t)}deg)` // nose up at first, levels out
            if (t >= 1) return void b.el.remove()
          }
          b.raf = requestAnimationFrame(step)
        }
        b.raf = requestAnimationFrame(step)
      }, 120)
    }, delay)
  }

  /**
   * comic "HAU AB!" shouted at the clicked bird: white outlined letters on a black starburst.
   * Shown below the bar and off to the side towards the middle of the screen, so a finger on the
   * bird doesn't cover it. Pops up and fades out while the bird flies off.
   */
  function shout(b: Bird) {
    const W = 140, H = 100
    const cx = W / 2, cy = H / 2
    /** gap between the bird and the burst, about a fingertip */
    const GAP = 28
    const box = perch.getBoundingClientRect()
    const bird = b.x + (TOE_CX * b.sc)
    const towardsLeft = box.left + bird > window.innerWidth / 2
    const want = towardsLeft ? bird - GAP - W : bird + GAP
    const left = Math.min(Math.max(want, 4 - box.left), window.innerWidth - box.left - W - 4)
    // irregular starburst: long and short spikes, fixed so it always looks the same
    const R = [1, 0.78, 0.95, 0.72, 1.08, 0.8, 0.9, 0.7, 1.02, 0.82, 0.93, 0.74, 1.05, 0.77]
    const n = R.length
    const burst = R.flatMap((r, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2
      const m = a + Math.PI / n
      return [
        `${cx + Math.cos(a) * 62 * r},${cy + Math.sin(a) * 47 * r}`,
        `${cx + Math.cos(m) * 40},${cy + Math.sin(m) * 30}`,
      ]
    }).join(' ')
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;left:${left}px;top:${LINE_Y + 6}px;width:${W}px;height:${H}px;pointer-events:none;z-index:2;transform-origin:50% 50%`
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" role="img" aria-label="Hau ab!">
      <polygon points="${burst}" fill="#111" stroke="#fff" stroke-width="4" stroke-linejoin="round" transform="rotate(-6 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" transform="rotate(-12 ${cx} ${cy})"
        font-family="Impact,'Arial Black',ui-sans-serif,sans-serif" font-weight="900" font-size="29" letter-spacing="0.5"
        fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="round" paint-order="stroke">HAU AB<tspan dx="2" font-size="33">!</tspan></text>
    </svg>`
    perch.appendChild(el)
    const stop = () => {
      el.remove()
      effects.delete(stop)
    }
    effects.add(stop)
    const frames = reduceMotion
      ? [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [
          { transform: 'scale(0.2)', opacity: 0 },
          { transform: 'scale(1.18)', opacity: 1, offset: 0.12 },
          { transform: 'scale(0.95)', offset: 0.2 },
          { transform: 'scale(1)', offset: 0.26 },
          { transform: 'scale(1) translateY(0)', opacity: 1, offset: 0.75 },
          { transform: 'scale(1) translateY(-6px)', opacity: 0 },
        ]
    el.animate(frames, { duration: SHOUT_MS, easing: 'ease-out' }).finished.then(stop, stop)
  }

  /** a startled bird takes its partner with it */
  function scare(b: Bird, delay = 0) {
    flyAway(b, delay)
    if (b.partner) flyAway(b.partner, delay + 150 + Math.random() * 150)
  }

  // ---------- the nuclear option ----------
  /** a couple goes up together: both charge up at the same moment and each gets its own mushroom */
  function nuke(b: Bird) {
    for (const x of [b, b.partner]) if (x && x.el.isConnected && !x.charging) nukeOne(x)
  }

  // stages (s, after the click):
  //  0.00-0.50  charge-up: the bird trembles, swells and flickers white/red
  //  0.50       detonation: colours invert for a blink, then a white flash
  //  0.50-0.90  fireball: white-hot ball, shockwave ring runs along the line
  //  0.70-2.60  mushroom: the cap climbs and rolls (puffs circulate around a ring), the stem
  //             sucks material up, a condensation ring flashes around it, dust rolls out along the line
  //  1.00-4.80  cooling: fire turns red, brown, grey; smoke drifts with the wind and dithers away
  //  0.50-4.50  feathers: burst out, tumble, flutter down; some burn up to ash
  //  scorch mark on the line fades last
  function nukeOne(b: Bird) {
    b.charging = true
    b.dead = true // stops idle/walk/groom timers
    cancelAnimationFrame(b.raf)
    b.q('.hit').hidden = true
    if (reduceMotion) return vanish(b)
    const box = perch.getBoundingClientRect()
    const s = b.sc / 2 // effect scale: 1 on desktop, .75 on phones
    const g = Math.max(2, Math.round(3 * s)) // one "explosion pixel"
    const cx = box.left + b.x + TOE_CX * b.sc, cy = box.top + LINE_Y - 12 * b.sc, ground = box.top + LINE_Y

    const c0 = performance.now()
    const charge = (now: number) => {
      if (!b.el.isConnected) return
      const t = (now - c0) / 500
      if (t < 1) {
        const k = t * t
        setUpper(b, `translateX(${(Math.random() * 2 - 1) * k * 2 * b.sc}px) scale(${1 + 0.25 * k})`)
        b.el.style.filter = Math.floor(now / (90 - 60 * k)) % 2
          ? 'brightness(2.2) saturate(0)'
          : 'sepia(1) saturate(8) hue-rotate(-35deg) brightness(1.2)'
        b.raf = requestAnimationFrame(charge)
        return
      }
      vanish(b)
      detonate()
    }
    b.raf = requestAnimationFrame(charge)

    function detonate() {
      const shakeEl = document.getElementById('__nuxt') ?? document.body
      const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1
      const cv = document.createElement('canvas')
      cv.width = w * dpr
      cv.height = h * dpr
      cv.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:100`
      cv.setAttribute('aria-hidden', 'true')
      document.body.appendChild(cv)
      const ctx = cv.getContext('2d')!
      ctx.scale(dpr, dpr)
      let raf = 0
      const stop = () => {
        cancelAnimationFrame(raf)
        cv.remove()
        shakeEl.style.transform = ''
        shakeEl.style.filter = ''
        effects.delete(stop)
      }
      effects.add(stop)

      const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16)
      const hash = (x: number, y: number, z: number) => {
        const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
        return n - Math.floor(n)
      }
      // dithered pixel: alpha becomes a pattern, not transparency, so it stays crisp
      const px = (x: number, y: number, c: string, a = 1) => {
        const gx = Math.floor(x / g), gy = Math.floor(y / g)
        if (a < 1 && a <= BAYER[(gy & 3) * 4 + (gx & 3)]!) return
        ctx.fillStyle = c
        ctx.fillRect(gx * g, gy * g, g, g)
      }
      const RAMP: [number, string][] = [[0.86, '#ffffff'], [0.72, '#fff1a8'], [0.58, '#ffc93c'], [0.46, '#ff8c1a'], [0.35, '#e04a1b'],
        [0.25, '#9c2a1a'], [0.16, '#6e4a3f'], [0.08, '#5e5a58'], [-9, '#403e3d']]
      const heat = (T: number) => RAMP.find(([lim]) => T > lim)![1]
      let tick = 0
      // one billow: shaded underneath, hotter in the middle, ragged flickering edge
      const puff = (x: number, y: number, r: number, T: number, a = 1) => {
        if (r < g * 0.6 || a <= 0) return
        for (let yy = y - r; yy <= y + r; yy += g) {
          for (let xx = x - r; xx <= x + r; xx += g) {
            const d = Math.hypot(xx - x, yy - y) / r
            if (d > 1 - 0.22 * hash(Math.floor(xx / g), Math.floor(yy / g), tick)) continue
            const shade = (yy - y) / r // -1 top .. 1 bottom
            px(xx, yy, heat(T * (1.15 - d * 0.45) - shade * 0.1), a)
          }
        }
      }
      const ease = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3

      const featherColors = [PAL.L, PAL.G, PAL.G, PAL.D, PAL.W, PAL.T, PAL.t, PAL.y, PAL.R] as string[]
      const feathers = Array.from({ length: 54 }, () => {
        const ang = rnd(-Math.PI * 0.97, -Math.PI * 0.03), sp = rnd(140, 460) * s
        return {
          x: cx + rnd(-6, 6), y: cy + rnd(-6, 6), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          rot: rnd(0, 6), spin: rnd(-9, 9), ph: rnd(0, 6), life: rnd(2.6, 4),
          burn: Math.random() < 0.3 ? rnd(0.4, 1.4) : 0,
          c: featherColors[Math.floor(rnd(0, featherColors.length))]!,
        }
      })
      const embers = Array.from({ length: 80 }, () => {
        const ang = rnd(0, Math.PI * 2), sp = rnd(80, 380) * s
        return { x: cx, y: cy, px: cx, py: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.75 - 60 * s, life: rnd(0.5, 1.6) }
      })
      const debris = Array.from({ length: 24 }, () => ({ x: cx, y: ground, vx: rnd(-260, 260) * s, vy: rnd(-260, -80) * s, life: rnd(0.8, 1.6) }))

      const CAP_N = 12, STEM_N = 8
      const t0 = performance.now()
      let last = t0
      const frame = (now: number) => {
        const t = (now - t0) / 1000, dt = Math.min((now - last) / 1000, 0.05)
        last = now
        tick = Math.floor(t * 14)
        ctx.clearRect(0, 0, w, h)

        // damped shake, colours inverted for the first blink
        const amp = 8 * Math.exp(-t * 4.5) * s
        shakeEl.style.transform = amp > 0.3 ? `translate(${Math.sin(t * 70) * amp}px, ${Math.cos(t * 53) * amp}px)` : ''
        shakeEl.style.filter = t < 0.07 ? 'invert(1)' : ''

        const fade = 1 - ease((t - 2.6) / 2.2) // smoke dithers away at the end
        const T = Math.max(0, 1.2 - t * 0.55) // overall temperature
        const wind = Math.max(0, t - 0.8) * 7 * s

        // scorch mark + glowing line
        if (t > 0.1) {
          const sw = 26 * s * ease(t / 0.4), sa = Math.min(1, 5.2 - t)
          for (let x = cx - sw; x <= cx + sw; x += g) {
            const edge = Math.abs(x - cx) / sw
            px(x, ground - g / 2, t < 0.8 && edge < 0.6 ? '#ff8c1a' : '#1d1b1a', sa * (1 - edge * 0.6))
          }
        }

        // shockwave ring along the line
        if (t < 0.8) {
          const r = (16 + t * 560) * s, a = 1 - t / 0.8
          for (let i = 0; i < 120; i++) {
            const ang = (i / 120) * Math.PI * 2
            px(cx + Math.cos(ang) * r, ground + Math.sin(ang) * r * 0.16, i % 4 ? '#ffe2b0' : '#ffffff', a)
          }
        }

        // dust surge rolling out along the line
        if (t > 0.55) {
          const p = ease((t - 0.55) / 1.6)
          for (let i = 0; i < 5; i++) {
            for (const side of [-1, 1]) {
              const d = (10 + p * 70 * (0.6 + i * 0.12)) * s
              puff(cx + side * d + wind, ground - 2 * s - i * s, (5 + i * 1.5 + p * 4) * s, Math.min(T, 0.3) - i * 0.02, fade * (1 - p * 0.5))
            }
          }
        }

        // mushroom: cap climbs, widens and rolls
        const rise = ease((t - 0.5) / 1.6)
        const capX = cx + wind, capY = Math.max(cy - rise * 48 * s, 16 * s)
        const Rx = (8 + 30 * ease((t - 0.5) / 1.1) + Math.max(0, t - 1.6) * 4) * s

        // stem: puffs travel upward from the line into the cap
        if (t > 0.72) {
          const sa = fade * Math.min(1, (t - 0.72) / 0.2)
          for (let k = 0; k < STEM_N; k++) {
            const f = (k / STEM_N + t * 0.7) % 1
            const y = ground - (ground - capY) * f
            puff(cx + wind * f + Math.sin(k * 1.7 + t * 4) * 1.5 * s, y, Rx * (0.16 + 0.16 * (1 - f)), T * (0.75 + 0.2 * f), sa)
          }
        }

        // condensation ring around the stem
        if (t > 1.0 && t < 2.1) {
          const p = (t - 1.0) / 1.1, ry = ground - (ground - capY) * 0.5
          const rx = (10 + p * 34) * s
          for (let i = 0; i < 60; i++) {
            const ang = (i / 60) * Math.PI * 2
            px(capX + Math.cos(ang) * rx, ry + Math.sin(ang) * rx * 0.18, '#f2f2f0', (1 - p) * 0.9)
          }
        }

        // cap puffs: back half, centre, front half (toroidal roll: outer edge goes down, inner up)
        if (t > 0.5) {
          const ca = Math.min(1, (t - 0.5) / 0.15) * fade
          const ring = Array.from({ length: CAP_N }, (_, i) => {
            const th = (i / CAP_N) * Math.PI * 2 + t * 2.4
            return { x: capX + Math.cos(th) * Rx * 0.78, y: capY + Math.sin(th) * Rx * 0.3, z: Math.sin(th), r: Rx * (0.4 + 0.06 * Math.sin(i * 2.3)) }
          })
          ring.filter(p => p.z < 0).forEach(p => puff(p.x, p.y, p.r, T * 0.9, ca))
          puff(capX, capY - Rx * 0.12, Rx * 0.6, T * 1.05, ca)
          ring.filter(p => p.z >= 0).forEach(p => puff(p.x, p.y, p.r, T * (0.95 + 0.15 * p.z), ca)) // glowing underside
        }

        // fireball (first moments)
        if (t < 0.95) {
          const r = (6 + 34 * ease(t / 0.22)) * s * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.35 * 0.6)
          puff(cx, cy - rise * 20 * s, r, 1.3 - t * 0.6, t < 0.6 ? 1 : 1 - (t - 0.6) / 0.35)
        }

        // embers with a short trail
        for (const e of embers) {
          if (t > e.life) continue
          e.px = e.x
          e.py = e.y
          e.vx *= 0.95
          e.vy = e.vy * 0.95 + 120 * dt * s
          e.x += e.vx * dt
          e.y += e.vy * dt
          const a = 1 - t / e.life
          px(e.px, e.py, heat(a * 0.7), a * 0.7)
          px(e.x, e.y, heat(0.3 + a * 0.6), a)
        }
        // dark debris thrown off the line
        for (const d of debris) {
          if (t > d.life) continue
          d.vy += 600 * dt * s
          d.x += d.vx * dt
          d.y += d.vy * dt
          px(d.x, d.y, '#2b2726', 1 - t / d.life)
        }

        // feathers: tumble (a 3-pixel quill rotating), then flutter down; burning ones glow and turn to ash
        for (const f of feathers) {
          if (t > f.life) continue
          f.vx *= 0.965
          f.vy = Math.min(f.vy * 0.965 + 280 * dt * s, 42 * s) // air drag: feathers sink slowly
          f.x += (f.vx + Math.sin(t * 4.5 + f.ph) * 38 * s) * dt
          f.y += f.vy * dt
          f.rot += f.spin * dt
          f.spin *= 0.99
          let c = f.c
          const a = Math.min(1, (f.life - t) / 0.7)
          if (f.burn) {
            if (t > f.burn + 0.5) continue // burnt up
            if (t > f.burn) c = t > f.burn + 0.3 ? '#4a4644' : (Math.floor(t * 20) % 2 ? '#ffb347' : '#ff6a1a')
          }
          const dx = Math.cos(f.rot) * g, dy = Math.sin(f.rot) * g * 0.7
          px(f.x - dx, f.y - dy, c, a)
          px(f.x, f.y, c, a)
          px(f.x + dx, f.y + dy, f.burn && t > f.burn ? c : PAL.o!, a * 0.9)
        }

        // flash
        if (t < 0.45) {
          ctx.fillStyle = '#fffbe6'
          ctx.globalAlpha = (1 - t / 0.45) ** 2
          ctx.fillRect(0, 0, w, h)
          ctx.globalAlpha = 1
        }

        if (t < 5.3) raf = requestAnimationFrame(frame)
        else stop()
      }
      raf = requestAnimationFrame(frame)
    }
  }

  // ---------- public ----------
  function land(pair: boolean) {
    vanish(male)
    vanish(female)
    female = undefined
    const sc = matchMedia('(min-width: 640px)').matches ? 1.5 : 1.125 // smaller on phones
    const m = male = makeBird(sc, PAL, 1)
    const tx = Math.round(rnd(m.minX, m.maxX))
    const ty = LINE_Y - WIRE_ROW * sc - Math.floor(sc / 2) // toe row lands on the 1px border
    const afterLanding = () => {
      idle(m)
      if (pair) later(m, addFemale, 1500 + Math.random() * 2500)
    }
    if (reduceMotion) {
      m.place(tx, ty)
      show(m, 'perch')
      return afterLanding()
    }
    flyIn(m, tx, ty, afterLanding)
  }

  return {
    land,
    busy: () => [male, female].some(b => b?.el.isConnected) || effects.size > 0,
    scareAll() {
      if (male && !male.dead) flyAway(male)
      if (female && !female.dead) flyAway(female, 150 + Math.random() * 150)
    },
    destroy() {
      vanish(male)
      vanish(female)
      for (const stop of [...effects]) stop()
    },
  }
}
