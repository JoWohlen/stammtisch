/**
 * Swiping (or ‹ ›) between members / Brauhäuser slides the page in from the side it came from;
 * every other navigation stays instant.
 */
export default defineNuxtRouteMiddleware((to) => {
  const dir = takeBrowseSlide()
  to.meta.pageTransition = dir ? { name: `slide-${dir}`, mode: 'out-in' } : false
})
