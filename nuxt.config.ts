// https://nuxt.com/docs/api/configuration/nuxt-config
import { existsSync, readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

/** Every restaurant and participant page, so `nuxt generate` emits them even if nothing links to them. */
const detailRoutes = (): string[] => {
  const file = new URL('./data/stammtisch.json', import.meta.url)
  if (!existsSync(file)) return []
  const { visits, participants } = JSON.parse(readFileSync(file, 'utf8')) as {
    visits: { slug: string }[]
    participants: { slug: string }[]
  }
  return [
    '/analyse',
    '/satzung',
    ...new Set(visits.map(v => `/brauhaus/${v.slug}`)),
    ...participants.map(p => `/teilnehmer/${p.slug}`),
  ]
}

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', 'shadcn-nuxt'],
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
      routes: detailRoutes(),
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
