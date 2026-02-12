import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { IconFileUpload, IconFolderDown, IconPlus, IconFolderPlus, IconBrandGoogleDrive, IconStackFilled } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { CreateFolderModal } from "@/components/modals/create-folder-modal"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@/components/user-context"
import { useGoogleDrive } from "@/hooks/use-google-drive"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useCurrentFolder } from "@/components/current-folder-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"
import { paperService } from "@/lib/paper-service"

interface SiteHeaderProps {
  className?: string
  sticky?: boolean
  onSearch?: (query: string) => void
  onFileUpload?: () => void
  onFolderUpload?: () => void
  customTitle?: React.ReactNode
}

export function SiteHeader({ className, sticky = false, onSearch, onFileUpload, onFolderUpload, customTitle }: SiteHeaderProps) {
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const { openPicker } = useGoogleDrive()
  const { notifyFileAdded } = useGlobalUpload()
  const { currentFolderId } = useCurrentFolder()

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

  const { startUploadWithFiles, registerOnFileAdded, unregisterOnFileAdded } = useGlobalUpload();
  const [cleanUpCallback, setCleanUpCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanUpCallback) cleanUpCallback();
    }
  }, [cleanUpCallback]);

  const handleNewPaper = useCallback(async () => {
    try {
      if (!masterKeyManager.hasMasterKey()) {
        toast.error("Encryption key missing. Please login.")
        return
      }

      // Open new tab immediately for instant feedback
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
      const filename = `Untitled paper ${dateStr} ${timeStr}`;
      const parentId = currentFolderId === 'root' ? null : currentFolderId;
      const newWin = window.open('/paper/new?creating=1', '_blank');
      toast('Creating paper...');

      try {
        const fileId = await paperService.createPaper(filename, undefined, parentId)

        notifyFileAdded({
          id: fileId,
          name: filename,
          type: 'paper',
          parentId: parentId,
          status: 'active',
          size: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          is_shared: false,
          mimeType: 'application/x-paper',
        } as any)

        toast.success('Paper created')

        if (fileId) {
          if (newWin && !newWin.closed) {
            newWin.location.href = `/paper?fileId=${fileId}`
          } else {
            window.open(`/paper?fileId=${fileId}`, '_blank')
          }
        }
      } catch (err) {
        console.error('Failed to create paper:', err)
        toast.error('Failed to create paper')
        if (newWin && !newWin.closed) newWin.close()
      }
    } catch (error) {
      console.error("Failed to create paper:", error)
      toast.error("Failed to create paper")
    }
  }, [currentFolderId, notifyFileAdded]);

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
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="-ml-1" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Toggle Sidebar <span className="text-muted-foreground ml-1">Ctrl+B</span></p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {customTitle ? (
          <div className="flex items-center gap-2">
            {customTitle}
          </div>
        ) : pathname?.startsWith('/assistant') ? (
          <h2 className="text-lg font-semibold tracking-tight">Assistant</h2>
        ) : (
          <div className="relative flex-1 max-w-md">
            {/* Search removed */}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                <IconPlus className="h-4 w-4 mr-2" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onFileUpload}>
                <IconFileUpload className="h-4 w-4 mr-2" />
                Upload Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onFolderUpload}>
                <IconFolderDown className="h-4 w-4 mr-2" />
                Upload Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openPicker}>
                <IconBrandGoogleDrive className="h-4 w-4 mr-2" stroke={1.5} />
                Import from Google Drive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsCreateFolderOpen(true)}>
                <IconFolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNewPaper}>
                <IconStackFilled className="h-4 w-4 mr-2" />
                New Paper
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <CreateFolderModal
            open={isCreateFolderOpen}
            onOpenChange={setIsCreateFolderOpen}
            onFolderCreated={(folder) => {
              if (folder) {
                notifyFileAdded(folder)
              } else {
                router.refresh()
              }
            }}
          />

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
