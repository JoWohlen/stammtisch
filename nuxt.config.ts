// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', 'nuxt-charts', 'shadcn-nuxt'],
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'Stammtisch-Tracker',
    },
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  vite: {
    plugins: [tailwindcss()],
  },
  typescript: {
    strict: true,
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
})
