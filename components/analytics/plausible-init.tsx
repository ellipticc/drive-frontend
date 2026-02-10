'use client'

import { useEffect } from 'react'
import { init } from '@plausible-analytics/tracker'

export default function PlausibleInit({ domain }: { domain: string }) {
  useEffect(() => {
    try {
      // Respect the loader's disabled flag
      if ((window as any).__PLAUSIBLE_DISABLED__) return
      init({ domain })
    } catch (e) {
      // silently ignore init errors
      console.warn('Plausible init failed', e)
    }
  }, [domain])

  return null
}
