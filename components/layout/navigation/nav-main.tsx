"use client"

import { IconFolderDown, IconFileUpload, IconPlus, IconFolderPlus, type Icon } from "@tabler/icons-react"
import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CreateFolderModal } from "@/components/modals/create-folder-modal"

export function NavMain({
  items,
  onFileUpload,
  onFolderUpload,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
  onFileUpload?: () => void
  onFolderUpload?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)

  const handleFileUpload = () => {
    onFileUpload?.()
  }

  const handleFolderUpload = () => {
    onFolderUpload?.()
  }

  const handleNavigate = (url: string) => {
    // Use router.push for soft navigation to keep global upload context alive
    // This prevents full page reload and preserves upload modal state
    router.push(url)
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="New"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                >
                  <IconPlus />
                  <span>New</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={handleFileUpload} className="cursor-pointer">
                  <IconFileUpload className="mr-2 h-4 w-4" />
                  Upload File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFolderUpload} className="cursor-pointer">
                  <IconFolderDown className="mr-2 h-4 w-4" />
                  Upload Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsCreateFolderOpen(true)} className="cursor-pointer">
                  <IconFolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <CreateFolderModal
              open={isCreateFolderOpen}
              onOpenChange={setIsCreateFolderOpen}
              onFolderCreated={() => {
                // Refresh logic if needed
                router.refresh()
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.title === 'Trash' ? (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  onClick={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                  id="tour-trash"
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : item.title === "Settings" ? (
                <SidebarMenuButton onClick={() => window.location.hash = '#settings/General'} id="tour-settings">
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  onClick={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
