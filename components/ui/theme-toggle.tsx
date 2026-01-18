"use client"

import * as React from "react"
import { IconMoon as Moon, IconSun as Sun } from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const { user, updateUser, refetch } = useUser()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleToggle = React.useCallback(async () => {
    const newMode = resolvedTheme === "light" ? "dark" : "light"
    setTheme(newMode)

    // If sync is on, disable it because user is making a manual choice
    if (user?.theme_sync) {
      try {
        updateUser({ theme_sync: false });
        await apiClient.updateProfile({ theme_sync: false });
        await refetch();
      } catch (err) {
        console.error("Failed to disable theme sync:", err);
      }
    }
  }, [resolvedTheme, setTheme, user?.theme_sync, updateUser, refetch])

  // Global shortcut Ctrl+D or Cmd+D
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleToggle()
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [handleToggle])

  if (!mounted) {
    return null
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleToggle}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Toggle Theme <span className="text-muted-foreground ml-1">Ctrl+D</span></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}