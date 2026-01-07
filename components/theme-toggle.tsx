"use client"

import * as React from "react"
import { IconMoon as Moon, IconSun as Sun } from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api"
import { Button } from "@/components/ui/button"

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme()
  const { user, updateUser, refetch } = useUser()

  const toggleTheme = async () => {
    const newMode = resolvedTheme === "dark" ? "light" : "dark"
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
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`h-8 w-8 px-0 ${className || ""}`}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}