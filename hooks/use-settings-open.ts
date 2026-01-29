import { useState, useEffect, useCallback } from "react"

export function useSettingsOpen() {
  const [open, setOpenLocal] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.location.hash.startsWith("#settings")
  })

  useEffect(() => {
    const handler = () => {
      const isOpen = typeof window !== "undefined" && window.location.hash.startsWith("#settings")
      console.log("[useSettingsOpen] Hash changed:", window.location.hash, "isOpen:", isOpen)
      setOpenLocal(isOpen)
    }
    // Call handler immediately to sync with current hash
    handler()
    window.addEventListener("hashchange", handler)
    return () => window.removeEventListener("hashchange", handler)
  }, [])

  const setOpen = useCallback((newOpen: boolean) => {
    console.log("[useSettingsOpen] setOpen called with:", newOpen)
    if (typeof window === "undefined") {
      setOpenLocal(newOpen)
      return
    }

    if (newOpen) {
      // Open settings (navigate to a sensible default tab if no hash present)
      if (!window.location.hash.startsWith("#settings")) {
        console.log("[useSettingsOpen] Opening settings, setting hash")
        window.location.hash = "#settings/General"
      }
      setOpenLocal(true)
    } else {
      // Close settings (clear settings hash)
      if (window.location.hash.startsWith("#settings")) {
        console.log("[useSettingsOpen] Closing settings, clearing hash")
        window.history.replaceState(null, "", window.location.pathname)
      }
      setOpenLocal(false)
    }
  }, [])

  return [open, setOpen] as const
}
