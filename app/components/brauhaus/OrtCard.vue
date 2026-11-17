<script setup lang="ts">
import { ExternalLink, Globe, MapPin, Navigation } from '@lucide/vue'
import type { Ort } from '@/composables/useStammtisch'

const props = defineProps<{ name: string, ort: Ort }>()

/** "https://www.foo.koeln/path/" → "foo.koeln/path" */
const prettyUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')

/** name + address finds the actual place entry (opening hours, photos), not just a pin */
const query = computed(() => [props.name, props.ort.adresse].filter(Boolean).join(', '))
const googleMaps = computed(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.value)}`)
const route = computed(() => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query.value)}`)

/** OpenStreetMap embed: no API key, no Google tracking; ~400 m × 400 m around the marker */
const osm = computed(() => {
  const c = props.ort.coords
  if (!c) return null
  const dLat = 0.0018
  const dLng = 0.0035
  const bbox = [c.lng - dLng, c.lat - dLat, c.lng + dLng, c.lat + dLat].map(n => n.toFixed(5)).join(',')
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${c.lat},${c.lng}`,
    link: `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=18/${c.lat}/${c.lng}`,
  }
})

const hasAny = computed(() => !!(props.ort.adresse || props.ort.website || props.ort.coords))
</script>

<template>
  <!-- two cards: address + buttons left, map right; stacked on phones -->
  <section
    v-if="hasAny"
    class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
  >
    <Card>
      <CardHeader>
        <CardTitle class="text-xl">
          Besuchen?
        </CardTitle>
        <CardDescription>
          Adresse, Karte und Website, falls du selbst mal wieder hin willst.
        </CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col gap-4">
        <div
          v-if="ort.adresse"
          class="flex gap-3"
        >
          <MapPin
            class="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div class="flex flex-col">
            <span class="font-medium">{{ name }}</span>
            <span>{{ ort.adresse }}</span>
            <span
              v-if="ort.lage"
              class="text-sm text-muted-foreground"
            >
              {{ ort.lage.stadtteil }}<template v-if="ort.lage.stadtbezirk !== ort.lage.stadtteil">
                · Bezirk {{ ort.lage.stadtbezirk }}
              </template>
            </span>
          </div>
        </div>

        <div
          v-if="ort.website"
          class="flex items-center gap-3"
        >
          <Globe
            class="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <a
            :href="ort.website"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-0 truncate underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
          >{{ prettyUrl(ort.website) }}</a>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <a
            :href="route"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Navigation
              class="size-4"
              aria-hidden="true"
            /> Route planen
          </a>
          <a
            :href="googleMaps"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ExternalLink
              class="size-4"
              aria-hidden="true"
            /> Google Maps
          </a>
        </div>
      </CardContent>
    </Card>

    <!-- map fills the whole card, as tall as the address card on wide screens -->
    <Card
      v-if="osm"
      class="relative gap-0 overflow-hidden p-0 sm:gap-0 sm:py-0"
    >
      <iframe
        :src="osm.embed"
        :title="`Karte: ${name}`"
        loading="lazy"
        referrerpolicy="no-referrer"
        class="block aspect-[4/3] w-full flex-1 md:aspect-auto md:min-h-72"
      />
      <a
        :href="osm.link"
        target="_blank"
        rel="noopener noreferrer"
        class="absolute top-2 right-2 rounded-md border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground"
      >
        Größere Karte
      </a>
    </Card>
  </section>
</template>
