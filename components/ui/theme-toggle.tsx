"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Hook for theme toggle with animation
const useThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user, updateUser, refetch } = useUser()
  const [isDark, setIsDark] = React.useState(false)

  // Sync isDark state with resolved theme after hydration
  React.useEffect(() => {
    setIsDark(resolvedTheme === "dark")
  }, [resolvedTheme])

  const styleId = "theme-transition-styles"

  const updateStyles = React.useCallback((css: string) => {
    if (typeof window === "undefined") return

    let styleElement = document.getElementById(styleId) as HTMLStyleElement

    if (!styleElement) {
      styleElement = document.createElement("style")
      styleElement.id = styleId
      document.head.appendChild(styleElement)
    }

    styleElement.textContent = css
  }, [])

  const toggleTheme = React.useCallback(async () => {
    setIsDark(!isDark)

    // Animation CSS for circle variant, top-right, no blur
    const animationCSS = `
      ::view-transition-group(root) {
        animation-duration: 1s;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
      }
            
      ::view-transition-new(root) {
        animation-name: reveal-light-top-right;
      }

      ::view-transition-old(root),
      .dark::view-transition-old(root) {
        animation: none;
        z-index: -1;
      }
      
      .dark::view-transition-new(root) {
        animation-name: reveal-dark-top-right;
      }

      @keyframes reveal-dark-top-right {
        from {
          clip-path: circle(0% at 100% 0%);
        }
        to {
          clip-path: circle(150.0% at 100% 0%);
        }
      }

      @keyframes reveal-light-top-right {
        from {
          clip-path: circle(0% at 100% 0%);
        }
        to {
          clip-path: circle(150.0% at 100% 0%);
        }
      }
    `

    updateStyles(animationCSS)

    if (typeof window === "undefined") return

    const newMode = theme === "light" ? "dark" : "light"
    
    const switchTheme = async () => {
      setTheme(newMode)
      
      // If sync is on, disable it because user is making a manual choice
      if (user?.theme_sync) {
        try {
          updateUser({ theme_sync: false })
          await apiClient.updateProfile({ theme_sync: false })
          await refetch()
        } catch (err) {
          console.error("Failed to disable theme sync:", err)
        }
      }
    }

    if (!document.startViewTransition) {
      await switchTheme()
      return
    }

    document.startViewTransition(switchTheme)
  }, [theme, setTheme, isDark, setIsDark, updateStyles, user?.theme_sync, updateUser, refetch])

  return {
    isDark,
    toggleTheme,
  }
}

export function ThemeToggle() {
  const { isDark, toggleTheme } = useThemeToggle()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Global shortcut Ctrl+D or Cmd+D
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleTheme()
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [toggleTheme])

  if (!mounted) {
    return null
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            )}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="sr-only">Toggle theme</span>
            <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
              <motion.g
                animate={{ rotate: isDark ? -180 : 0 }}
                transition={{ ease: "easeInOut", duration: 0.5 }}
              >
                <path
                  d="M120 67.5C149.25 67.5 172.5 90.75 172.5 120C172.5 149.25 149.25 172.5 120 172.5"
                  fill="currentColor"
                />
                <path
                  d="M120 67.5C90.75 67.5 67.5 90.75 67.5 120C67.5 149.25 90.75 172.5 120 172.5"
                  fill="currentColor"
                  className="opacity-30"
                />
              </motion.g>
              <motion.path
                animate={{ rotate: isDark ? 180 : 0 }}
                transition={{ ease: "easeInOut", duration: 0.5 }}
                d="M120 3.75C55.5 3.75 3.75 55.5 3.75 120C3.75 184.5 55.5 236.25 120 236.25C184.5 236.25 236.25 184.5 236.25 120C236.25 55.5 184.5 3.75 120 3.75ZM120 214.5V172.5C90.75 172.5 67.5 149.25 67.5 120C67.5 90.75 90.75 67.5 120 67.5V25.5C172.5 25.5 214.5 67.5 214.5 120C214.5 172.5 172.5 214.5 120 214.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Toggle Theme <span className="text-muted-foreground ml-1">Ctrl+D</span></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}