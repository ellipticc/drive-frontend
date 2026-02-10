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
    
    // Also listen for a custom event for manual state updates
    const customHandler = () => handler()
    window.addEventListener("settings-state-changed", customHandler)
    
    return () => {
      window.removeEventListener("hashchange", handler)
      window.removeEventListener("settings-state-changed", customHandler)
    }
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
        // Preserve search params when clearing hash
        const url = new URL(window.location.href)
        url.hash = ""
        window.history.replaceState(null, "", url.toString())
        // Manually trigger state update
        setOpenLocal(false)
        // Dispatch custom event to sync across all instances
        window.dispatchEvent(new Event("settings-state-changed"))
      }
    }
  }, [])

  return [open, setOpen] as const
}
