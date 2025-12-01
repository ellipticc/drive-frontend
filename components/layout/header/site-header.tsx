import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { IconSearch, IconUpload, IconFileUpload, IconFolderDown } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SiteHeaderProps {
  onSearch?: (query: string) => void
  onFileUpload?: () => void
  onFolderUpload?: () => void
}

export function SiteHeader({ onSearch, onFileUpload, onFolderUpload }: SiteHeaderProps) {
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
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8">
                <IconUpload className="h-4 w-4 mr-2" />
                Upload
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
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
