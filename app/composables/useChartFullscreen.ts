import type { InjectionKey, Ref } from 'vue'

export interface ChartFullscreen {
  /** true while the chart card covers the whole screen */
  isFull: Readonly<Ref<boolean>>
  toggle: () => void
}

export const CHART_FULLSCREEN: InjectionKey<ChartFullscreen> = Symbol('chart-fullscreen')

/** fullscreen state of the surrounding <FullscreenCard>; outside one it is always false */
export function useChartFullscreen(): ChartFullscreen {
  return inject(CHART_FULLSCREEN, { isFull: ref(false), toggle: () => {} })
}
