/**
 * Swiping (or ‹ ›) between members / Brauhäuser slides the page in from the side it came from;
 * every other navigation stays instant.
 *
 * The instant case is a CSS-less transition rather than `false`: with `false` Nuxt renders the page
 * without a <Transition> at all, and one that only appears together with the next page doesn't
 * animate, so the first swipe after a page load would jump.
 */
export default defineNuxtRouteMiddleware((to) => {
  const dir = takeBrowseSlide()
  to.meta.pageTransition = dir ? { name: `slide-${dir}`, mode: 'out-in' } : { name: 'instant', css: false }
})
