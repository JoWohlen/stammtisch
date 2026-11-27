/**
 * Swiping (or ‹ ›) between members / Brauhäuser slides the page in from the side it came from,
 * opening one of them from elsewhere zooms it in; every other navigation stays instant.
 *
 * The instant case is a CSS-less transition rather than `false`: with `false` Nuxt renders the page
 * without a <Transition> at all, and one that only appears together with the next page doesn't
 * animate, so the first swipe after a page load would jump.
 */
/** member and Brauhaus pages: opening one (clicking a name or a restaurant) zooms it in */
const isDetail = (path: string) => /^\/(teilnehmer|brauhaus)\/[^/]/.test(path)

export default defineNuxtRouteMiddleware((to, from) => {
  const dir = takeBrowseSlide()
  if (dir) to.meta.pageTransition = { name: `slide-${dir}`, mode: 'out-in' }
  else if (isDetail(to.path) && to.path !== from.path) to.meta.pageTransition = { name: 'open-detail', mode: 'out-in' }
  else to.meta.pageTransition = { name: 'instant', css: false }
})
