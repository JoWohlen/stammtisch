// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', 'nuxt-charts'],
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'Stammtisch-Tracker',
    },
  },
  compatibilityDate: '2025-07-15',
  typescript: {
    strict: true,
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
