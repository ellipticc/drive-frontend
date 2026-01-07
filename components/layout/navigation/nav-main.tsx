"use client"

import { IconFolderDown, IconFileUpload, IconPlus, IconFolderPlus, type Icon } from "@tabler/icons-react"
import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"

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
    id?: string
  }[]
  onFileUpload?: () => void
  onFolderUpload?: () => void
}) {
  const { t } = useLanguage()
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
                  tooltip={t("common.new")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                >
                  <IconPlus />
                  <span>{t("common.new")}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={handleFileUpload} className="cursor-pointer">
                  <IconFileUpload className="me-2 h-4 w-4" />
                  {t("files.uploadFile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFolderUpload} className="cursor-pointer">
                  <IconFolderDown className="me-2 h-4 w-4" />
                  {t("files.uploadFolder")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsCreateFolderOpen(true)} className="cursor-pointer">
                  <IconFolderPlus className="me-2 h-4 w-4" />
                  {t("files.newFolder")}
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
              {item.id === 'trash' ? (
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
              ) : item.id === "settings" ? (
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
