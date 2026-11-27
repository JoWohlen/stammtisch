<script setup lang="ts">
import { Check, Copy, Mail, MessageCircle, MessageSquare, Send, Share2 } from '@lucide/vue'
import QRCode from 'qrcode'

useHead({ title: 'Teilen · Stammtisch-Tracker' })

const TITLE = 'Stammtisch-Tracker'
/** the public site — fixed, so the QR code is the same no matter where the page is opened */
const SITE_URL = 'https://jowohlen.github.io/stammtisch/'

const url = ref('')
const qrSrc = ref('')
/** native share sheet — only offered on HTTPS (or localhost) */
const canShare = ref(false)
/** touch device: gets a share button even without the native sheet */
const isMobile = ref(false)

onMounted(async () => {
  url.value = SITE_URL
  canShare.value = typeof navigator.share === 'function'
  isMobile.value = matchMedia('(pointer: coarse)').matches
  // always dark on white so the code scans in night mode too
  qrSrc.value = await QRCode.toDataURL(url.value, {
    width: 512,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
})

const showShare = computed(() => canShare.value || isMobile.value)

/** fallback targets when the native share sheet isn't available */
const targets = computed(() => {
  const u = encodeURIComponent(url.value)
  const text = encodeURIComponent(`${TITLE}: ${url.value}`)
  return [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${text}` },
    { label: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(TITLE)}` },
    { label: 'SMS', icon: MessageSquare, href: `sms:?&body=${text}` },
    { label: 'E-Mail', icon: Mail, href: `mailto:?subject=${encodeURIComponent(TITLE)}&body=${u}` },
  ]
})
const targetsOpen = ref(false)

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copiedTimer))

const copyLink = async () => {
  await navigator.clipboard.writeText(url.value)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
}

const onClick = async () => {
  if (!showShare.value) return copyLink()
  if (!canShare.value) {
    targetsOpen.value = !targetsOpen.value
    return
  }
  try {
    await navigator.share({ title: TITLE, url: url.value })
  }
  catch (e) {
    // the user closing the share sheet is not an error
    if ((e as DOMException).name !== 'AbortError') targetsOpen.value = true
  }
}
</script>

<template>
  <AppPage
    title="Teilen"
    description="Scanne den QR-Code oder teile den Link zum Stammtisch-Tracker"
  >
    <Card class="mx-auto w-full max-w-sm">
      <CardContent class="flex flex-col items-center gap-5">
        <div class="aspect-square w-full max-w-64 rounded-xl bg-white p-4 shadow-xs ring-1 ring-border">
          <img
            v-if="qrSrc"
            :src="qrSrc"
            :alt="`QR-Code für ${url}`"
            class="size-full [image-rendering:pixelated]"
          >
        </div>

        <p class="min-h-5 text-center text-sm break-all text-muted-foreground select-text">
          {{ url }}
        </p>

        <button
          type="button"
          class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
          :disabled="!url"
          :aria-expanded="showShare && !canShare ? targetsOpen : undefined"
          @click="onClick"
        >
          <Share2
            v-if="showShare"
            class="size-4"
            aria-hidden="true"
          />
          <Check
            v-else-if="copied"
            class="size-4"
            aria-hidden="true"
          />
          <Copy
            v-else
            class="size-4"
            aria-hidden="true"
          />
          {{ showShare ? 'Teilen' : copied ? 'Link kopiert' : 'Link kopieren' }}
        </button>

        <div
          v-if="targetsOpen"
          class="grid w-full grid-cols-2 gap-2"
        >
          <a
            v-for="t in targets"
            :key="t.label"
            :href="t.href"
            target="_blank"
            rel="noopener"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
          >
            <component
              :is="t.icon"
              class="size-4"
              aria-hidden="true"
            />
            {{ t.label }}
          </a>
        </div>
      </CardContent>
    </Card>
  </AppPage>
</template>
