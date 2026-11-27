/** fired on window when the drunk easter egg (DrunkEasterEgg.vue) starts: the beer is served */
export const DRUNK_EVENT = 'stammtisch:drunk'

/** true while the beer is served or the drunk effect is running */
export const isDrunk = () => document.documentElement.classList.contains('drunk') || document.documentElement.classList.contains('beer')

/** fire on window to serve the beer (same as shaking the phone / pressing G), e.g. from a hidden tap target */
export const SERVE_BEER_EVENT = 'stammtisch:serve-beer'

export const serveBeer = () => window.dispatchEvent(new Event(SERVE_BEER_EVENT))
