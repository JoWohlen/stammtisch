// https://nuxt.com/docs/api/configuration/nuxt-config
import { existsSync, readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

/** Every restaurant page, so `nuxt generate` emits them even if nothing links to them. */
const brauhausRoutes = (): string[] => {
  const file = new URL('./data/stammtisch.json', import.meta.url)
  if (!existsSync(file)) return []
  const { visits } = JSON.parse(readFileSync(file, 'utf8')) as { visits: { slug: string }[] }
  return [...new Set(visits.map(v => `/brauhaus/${v.slug}`))]
}

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
  nitro: {
    prerender: {
      routes: brauhausRoutes(),
      // TODO: remove once app/pages/teilnehmer/[slug].vue exists
      ignore: ['/teilnehmer'],
    },
  },
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
