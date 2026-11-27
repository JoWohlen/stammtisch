<script setup lang="ts">
import { onKeyStroke, useEventListener, useScrollLock } from '@vueuse/core'
import { BEER_H, BEER_W, bottleRuns, capRuns } from '@/lib/beer-sprite'
import { DRUNK_EVENT } from '@/lib/drunk'

/**
 * Easter egg: shaking the phone (or pressing G on a keyboard) serves a Gilden Kölsch.
 *
 * 1. The page fades to dark and a bottle fades in in the middle; only the bottle can be clicked.
 * 2. A click pops the cap off, then the bottle fades away
 *    while the page fades back in.
 * 3. Then the page is drunk for 10 s: everything sways smoothly, each element on its own, and goes
 *    blurry with a drifting ghost image (double vision). Fades in over 3 s and out over the last 4 s (eased),
 *    then everything is as before. Another beer while drunk keeps it going for another 10 s.
 *
 * The drunk look is in main.css (`html.drunk`), driven by `--drunk` (0 = sober … 1 = fully drunk),
 * `--drunk-blur` (the same, eased at both ends) and `--t` (seconds, the clock for the sine waves).
 *
 * Shaking works where the browser gives motion data without asking (Android); iPhones only give it
 * after a permission prompt, which we don't show for an easter egg.
 */

const DURATION_MS = 10_000
const RAMP_UP_MS = 3_000
const RAMP_DOWN_MS = 4_000

/** change in acceleration (m/s²) between two readings that counts as a jolt */
const JOLT = 22
/** this many jolts within SHAKE_WINDOW_MS make a shake */
const JOLTS = 3
const SHAKE_WINDOW_MS = 1_000

/** the elements that move on their own (same list as in main.css) */
const MOVERS = 'main :is([data-slot="card"], h1, h2, h3, p, li, button, svg, img, table, [data-slot="badge"]), [data-app-bar] > div > *'
const WAVE_VARS = ['--f', '--ph', '--ax', '--ay', '--ar']

const root = () => document.documentElement
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** the bottle's pixels (see lib/beer-sprite.ts) */
const BOTTLE = bottleRuns()
const CAP = capRuns()
/** screen pixels per bottle pixel: whole numbers keep the pixel art crisp */
const px = ref(4)

// ---------- the beer ----------

/** idle → offer (bottle shown, waiting for the click) → opening (cap pops) → drinking (bottle fades away) */
const state = ref<'idle' | 'offer' | 'opening' | 'drinking'>('idle')
/** the dark layer over the page */
const dark = ref(false)
const bottle = useTemplateRef<HTMLElement>('bottle')
const cap = useTemplateRef<HTMLElement>('cap')
const plopp = useTemplateRef<HTMLElement>('plopp')
/** the printed parts of both labels: turned in from the side when the bottle arrives */
const button = useTemplateRef<HTMLButtonElement>('button')
const scrollLock = useScrollLock(import.meta.client ? document.body : null)
/** the page behind can't be clicked, focused or scrolled while the bottle is there */
const app = () => document.getElementById('__nuxt')

async function offer() {
  if (state.value !== 'idle') return
  state.value = 'offer'
  root().classList.add('beer')
  app()?.setAttribute('inert', '')
  scrollLock.value = true
  // the Halsbandsittich (SittichEasterEgg.vue) flies off and stays away
  window.dispatchEvent(new Event(DRUNK_EVENT))
  px.value = Math.max(2, Math.floor(Math.min(window.innerHeight * 0.62, 520) / BEER_H))
  await nextTick()
  requestAnimationFrame(() => (dark.value = true))
  // slowly comes out of the depth
  const arrive = { duration: 2600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  bottle.value?.animate(
    reduceMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'translate3d(0, 90px, -700px) rotateX(8deg)' },
          { opacity: 1, offset: 0.4 },
          { opacity: 1, transform: 'none' },
        ],
    arrive,
  )
  button.value?.focus({ preventScroll: true })
}

async function open() {
  if (state.value !== 'offer') return
  state.value = 'opening'
  if (!reduceMotion()) {
    // the cap shoots up tumbling towards the viewer, then falls off the screen
    cap.value?.animate([
      { transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg)' },
      { transform: 'translate3d(-20px, -110px, 160px) rotateX(260deg) rotateY(140deg) rotateZ(-40deg)', offset: 0.3, easing: 'cubic-bezier(0.3, 0, 0.7, 1)' },
      { transform: 'translate3d(-70px, 110vh, 80px) rotateX(900deg) rotateY(420deg) rotateZ(-160deg)' },
    ], { duration: 1400, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'forwards' })
    plopp.value?.animate([
      { opacity: 0, transform: 'translate(-50%, 0) scale(0.3) rotate(-8deg)' },
      { opacity: 1, transform: 'translate(-50%, -28px) scale(1.15) rotate(-8deg)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%, -34px) scale(1) rotate(-8deg)', offset: 0.6 },
      { opacity: 0, transform: 'translate(-50%, -48px) scale(1) rotate(-8deg)' },
    ], { duration: 900, easing: 'ease-out', fill: 'forwards' })
    await sleep(450)
  }
  else {
    cap.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
  }

  // after the pop the bottle fades away and the page comes back
  state.value = 'drinking'
  dark.value = false
  app()?.removeAttribute('inert')
  scrollLock.value = false
  await bottle.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' })
    .finished.catch(() => {})
  state.value = 'idle'
  root().classList.remove('beer')
  // only now, with the beer drunk, it kicks in
  drink()
}

function closeBeer() {
  if (state.value === 'idle') return
  state.value = 'idle'
  dark.value = false
  root().classList.remove('beer')
  app()?.removeAttribute('inert')
  scrollLock.value = false
}

// ---------- drunk ----------

let start = 0
let movers: HTMLElement[] = []
let raf = 0
/** the last level before easing (0 … 1) */
let current = 0

function frame(now: number) {
  const e = now - start
  // 0 → 1 → 0 in a straight line, then eased so it starts and ends softly
  const level = e < RAMP_UP_MS
    ? e / RAMP_UP_MS
    : e > DURATION_MS - RAMP_DOWN_MS ? Math.max(0, (DURATION_MS - e) / RAMP_DOWN_MS) : 1
  current = level
  const smooth = level * level * (3 - 2 * level)
  // the movement eases in and out; the blur even more softly, so it creeps in and out
  root().style.setProperty('--drunk', smooth.toFixed(3))
  root().style.setProperty('--drunk-blur', (level ** 3 * (level * (6 * level - 15) + 10)).toFixed(3))
  root().style.setProperty('--t', (e / 1000).toFixed(3))
  if (e < DURATION_MS) raf = requestAnimationFrame(frame)
  else sober()
}

function drink() {
  const already = root().classList.contains('drunk')
  // another beer while drunk: fades back up from where it is (no jump) and lasts another 10 s
  start = performance.now() - (already ? RAMP_UP_MS * current : 0)
  if (already) return
  shuffle()
  root().classList.add('drunk')
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}

const rnd = (a: number, z: number) => a + Math.random() * (z - a)
const sign = () => (Math.random() < 0.5 ? -1 : 1)

/** every element its own speed, phase, size and direction of movement, so nothing moves in sync */
function shuffle() {
  movers = [...document.querySelectorAll<HTMLElement>(MOVERS)]
  for (const el of movers) {
    el.style.setProperty('--f', rnd(0.6, 1.7).toFixed(2))
    el.style.setProperty('--ph', `${rnd(0, 6.28).toFixed(2)}rad`)
    el.style.setProperty('--ax', (sign() * rnd(0.5, 1.3)).toFixed(2))
    el.style.setProperty('--ay', (sign() * rnd(0.5, 1.3)).toFixed(2))
    el.style.setProperty('--ar', (sign() * rnd(0.4, 1.3)).toFixed(2))
  }
}

function sober() {
  cancelAnimationFrame(raf)
  for (const el of movers) for (const v of WAVE_VARS) el.style.removeProperty(v)
  movers = []
  root().classList.remove('drunk')
  root().style.removeProperty('--drunk')
  root().style.removeProperty('--drunk-blur')
  root().style.removeProperty('--t')
}

// ---------- triggers ----------

// desktop: G, but not while typing in a field or with a modifier (Ctrl+G etc. stay the browser's)
onKeyStroke(['g', 'G'], (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return
  const t = ev.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
  offer()
})

// phone: a few hard jolts in a row
let last: { x: number, y: number, z: number } | null = null
let jolts: number[] = []
useEventListener(import.meta.client ? window : null, 'devicemotion', (ev: DeviceMotionEvent) => {
  const a = ev.accelerationIncludingGravity
  if (a?.x == null || a.y == null || a.z == null) return
  const cur = { x: a.x, y: a.y, z: a.z }
  if (last) {
    const d = Math.hypot(cur.x - last.x, cur.y - last.y, cur.z - last.z)
    if (d > JOLT) {
      const now = performance.now()
      jolts = [...jolts.filter(t => now - t < SHAKE_WINDOW_MS), now]
      if (jolts.length >= JOLTS) {
        jolts = []
        offer()
      }
    }
  }
  last = cur
}, { passive: true })

onBeforeUnmount(() => {
  closeBeer()
  sober()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state !== 'idle'"
      class="fixed inset-0 z-[60] grid place-items-center"
      :class="state === 'drinking' ? 'pointer-events-none' : ''"
      role="dialog"
      aria-modal="true"
      aria-label="Ein Gilden Kölsch"
    >
      <!-- the page fades out (slowly) behind the bottle and in again while it is drunk -->
      <div
        class="absolute inset-0 bg-black/85 transition-opacity duration-[1600ms] ease-out"
        :class="dark ? 'opacity-100' : 'opacity-0'"
      />

      <!-- perspective here, every layer below keeps its 3D space; no focus ring (G focuses it from the keyboard) -->
      <button
        ref="button"
        type="button"
        class="relative cursor-pointer outline-none [perspective:1100px] [-webkit-tap-highlight-color:transparent] disabled:cursor-default"
        :disabled="state !== 'offer'"
        aria-label="Flasche öffnen"
        @click="open"
      >
        <div
          ref="bottle"
          class="relative [transform-origin:50%_5%] [transform-style:preserve-3d]"
          :style="{ width: `${BEER_W * px}px`, height: `${BEER_H * px}px` }"
        >
          <!-- gentle tilt and bob the whole time (stopping would make it jump) -->
          <div class="beer-sway absolute inset-0 [transform-style:preserve-3d]">
            <!-- pixel-art bottle, see lib/beer-sprite.ts -->
            <svg
              :viewBox="`0 0 ${BEER_W} ${BEER_H}`"
              class="absolute inset-0 size-full"
              shape-rendering="crispEdges"
              aria-hidden="true"
            >
              <rect
                v-for="(r, i) in BOTTLE"
                :key="i"
                :x="r.x"
                :y="r.y"
                :width="r.w"
                height="1"
                :fill="r.c"
              />
            </svg>

            <!-- the cap on the same grid, its own element so it can tumble off -->
            <svg
              ref="cap"
              :viewBox="`0 0 ${BEER_W} ${BEER_H}`"
              class="absolute inset-0 size-full [transform-origin:50%_2%] [backface-visibility:visible]"
              shape-rendering="crispEdges"
              aria-hidden="true"
            >
              <rect
                v-for="(r, i) in CAP"
                :key="i"
                :x="r.x"
                :y="r.y"
                :width="r.w"
                height="1"
                :fill="r.c"
              />
            </svg>

            <span
              ref="plopp"
              class="pointer-events-none absolute -top-2 left-1/2 font-mono text-2xl font-black tracking-wide text-amber-300 opacity-0 [text-shadow:3px_3px_0_#000]"
              aria-hidden="true"
            >PLOPP!</span>
          </div>
        </div>
      </button>
      <span class="sr-only">Auf die Flasche tippen, um sie zu öffnen.</span>
    </div>
  </Teleport>
</template>

<style scoped>
/* the whole bottle: a slight tilt and moving a little towards the viewer and back */
.beer-sway {
  animation: beer-sway 4.5s ease-in-out infinite;
}
@keyframes beer-sway {
  0%, 100% { transform: rotateZ(-1.5deg) translateZ(0); }
  50% { transform: rotateZ(1.5deg) translateZ(40px); }
}
@media (prefers-reduced-motion: reduce) {
  .beer-sway {
    animation: none;
  }
}
</style>
