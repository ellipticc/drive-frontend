import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { IconSearch, IconFileUpload, IconFolderDown, IconPlus, IconFolderPlus, IconBrandGoogleDrive } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { CreateFolderModal } from "@/components/modals/create-folder-modal"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/user-context"
import { useGoogleDrive } from "@/hooks/use-google-drive"

import { useGlobalUpload } from "@/components/global-upload-context"

// Use a module-level variable to persist dismissal across SPA navigation but reset on page refresh
let isUpgradeDismissedGlobal = false;

interface SiteHeaderProps {
  onSearch?: (query: string) => void
  onFileUpload?: () => void
  onFolderUpload?: () => void
  searchValue?: string
}

export function SiteHeader({ onSearch, onFileUpload, onFolderUpload, searchValue }: SiteHeaderProps) {
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [, setForceUpdate] = useState(0)
  const { deviceQuota } = useUser()
  const router = useRouter()
  const { openPicker } = useGoogleDrive()
  const { notifyFileAdded } = useGlobalUpload()

  const handleUpgradeClick = () => {
    isUpgradeDismissedGlobal = true
    setForceUpdate(prev => prev + 1)
    window.open('/pricing', '_blank')
  }

  const isFreePlan = deviceQuota?.planName === 'Free'
  const showUpgrade = isFreePlan && !isUpgradeDismissedGlobal

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search files and folders..."
            className="pl-9 pr-4"
            value={searchValue || ""}
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {showUpgrade && (
            <Button
              size="sm"
              className="hidden md:inline-flex h-8 text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#704dff' }}
              onClick={handleUpgradeClick}
            >
              Click to upgrade
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild id="tour-new-button">
              <Button size="sm" className="h-8">
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
