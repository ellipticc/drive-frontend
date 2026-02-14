import { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { IconPlus } from "@tabler/icons-react"

interface SiteHeaderProps {
  className?: string
  sticky?: boolean
  customTitle?: React.ReactNode
}

export function SiteHeader({ className, sticky = false, customTitle }: SiteHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Auto-enable sticky on common dashboard routes unless explicitly set
  const [autoSticky, setAutoSticky] = useState(false)
  useEffect(() => {
    try {
      const dashboardPaths = ['/analytics', '/dashboard', '/backup']
      const p = typeof window !== 'undefined' ? window.location.pathname : ''
      setAutoSticky(dashboardPaths.some(dp => p.startsWith(dp)))
    } catch (err) {
      // ignore
    }
  }, [])

  const effectiveSticky = sticky || autoSticky

  const [cleanUpCallback, setCleanUpCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanUpCallback) cleanUpCallback();
    }
  }, [cleanUpCallback]);

  return (
    <header
      data-site-header
      data-sticky={effectiveSticky ? "true" : undefined}
      className={cn(
        "flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)",
        "bg-background",
        "sticky top-0 z-50 flex w-full items-center border-b bg-background",
        className
      )}
    >

      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {/* Mobile: sidebar trigger */}
        <div className="md:hidden mr-2">
          <SidebarTrigger />
        </div>
        {customTitle ? (
          <div className="flex items-center gap-2">
            {customTitle}
          </div>
        ) : pathname?.startsWith('/assistant') ? (
          <h2 className="text-lg font-semibold tracking-tight">Assistant</h2>
        ) : (
          <div className="relative flex-1 max-w-md">
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Mobile: new-chat button on top-right */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push('/new')} title="New Chat">
              <IconPlus className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
