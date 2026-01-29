import { useState, useEffect, useCallback } from "react"

export function useSettingsOpen() {
  const [open, setOpenLocal] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.location.hash.startsWith("#settings")
  })

  useEffect(() => {
    const handler = () => {
      const isOpen = typeof window !== "undefined" && window.location.hash.startsWith("#settings")
      setOpenLocal(isOpen)
    }
    // Call handler immediately to sync with current hash
    handler()
    window.addEventListener("hashchange", handler)
    return () => window.removeEventListener("hashchange", handler)
  }, [])

  const setOpen = useCallback((newOpen: boolean) => {
    if (typeof window === "undefined") {
      setOpenLocal(newOpen)
      return
    }

    if (newOpen) {
      // Open settings (navigate to a sensible default tab if no hash present)
      if (!window.location.hash.startsWith("#settings")) {
        window.location.hash = "#settings/General"
      }
      // State will be updated by hashchange event
    } else {
      // Close settings (clear settings hash)
      if (window.location.hash.startsWith("#settings")) {
        window.history.replaceState(null, "", window.location.pathname)
        // Manually update state since replaceState doesn't trigger hashchange
        setOpenLocal(false)
      }
    }
  }, [])

  return [open, setOpen] as const
}
