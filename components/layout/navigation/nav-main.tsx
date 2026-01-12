"use client"

import { IconChevronRight, IconLoader2, type Icon } from "@tabler/icons-react"
import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { apiClient, FolderContentItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { NavFolder } from "./nav-folder"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    id?: string
  }[]
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()

  // States for "My files" expansion
  const [isMyFilesExpanded, setIsMyFilesExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("my-files-expanded") === "true"
    }
    return false
  })
  const [rootSubfolders, setRootSubfolders] = useState<FolderContentItem[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [hasLoadedRoot, setHasLoadedRoot] = useState(false)
  const [isMyFilesLeaf, setIsMyFilesLeaf] = useState(false)

  const fetchRootFolders = useCallback(async () => {
    if (hasLoadedRoot) return
    setIsLoadingFolders(true)
    try {
      const response = await apiClient.getFolderContents("root")
      if (response.success && response.data) {
        const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null
        const decrypted = await Promise.all(
          response.data.folders.map(async (f) => {
            let name = "Encrypted Folder"
            try {
              if (masterKey) {
                name = await decryptFilename(f.encryptedName, f.nameSalt, masterKey)
              }
            } catch (err) {
              console.error("Failed sidebar decrypt", err)
            }
            return { ...f, name }
          })
        )
        setRootSubfolders(decrypted)
        setHasLoadedRoot(true)
        if (decrypted.length === 0) {
          setIsMyFilesLeaf(true)
          setIsMyFilesExpanded(false)
        }
      } else {
        setIsMyFilesLeaf(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingFolders(false)
    }
  }, [hasLoadedRoot])

  useEffect(() => {
    if (isMyFilesExpanded && !hasLoadedRoot) {
      fetchRootFolders()
    }
  }, [isMyFilesExpanded, hasLoadedRoot, fetchRootFolders])

  const toggleMyFiles = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !isMyFilesExpanded
    setIsMyFilesExpanded(next)
    sessionStorage.setItem("my-files-expanded", String(next))
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
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.id === 'my-files' ? (
                <div className="space-y-1">
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url || (item.url === '/' && pathname === '/')}
                    onClick={(e) => {
                      if (item.url === '/') {
                        // Force simple navigation to root
                        if (pathname === '/') return; // Already there
                        handleNavigate('/');
                        if (!isMyFilesExpanded) {
                          setIsMyFilesExpanded(true);
                          sessionStorage.setItem("my-files-expanded", "true");
                        }
                      } else {
                        handleNavigate(item.url);
                      }
                    }}
                    className="cursor-pointer relative pr-8"
                  >
                    {item.icon && <item.icon className="shrink-0" />}
                    <span>{item.title}</span>
                    {!isMyFilesLeaf && (
                      <div
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleMyFiles(e)
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm transition-colors text-muted-foreground/40 hover:text-muted-foreground z-20"
                      >
                        <IconChevronRight
                          className={cn("size-3.5 transition-transform duration-200", isMyFilesExpanded && "rotate-90")}
                        />
                      </div>
                    )}
                  </SidebarMenuButton>

                  {isMyFilesExpanded && (
                    <SidebarMenuSub className="ml-3.5 border-l border-border/50">
                      {isLoadingFolders ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground italic">
                          <IconLoader2 className="size-3 animate-spin" />
                          {t("sidebar.loading")}
                        </div>
                      ) : rootSubfolders.length > 0 ? (
                        rootSubfolders.map((folder) => (
                          <NavFolder
                            key={folder.id}
                            folder={{ id: folder.id, name: folder.name || "Untitled", parentId: folder.parentId }}
                          />
                        ))
                      ) : hasLoadedRoot ? (
                        <div className="px-2 py-1 text-[10px] text-muted-foreground/60 italic">
                          {t("sidebar.empty")}
                        </div>
                      ) : null}
                    </SidebarMenuSub>
                  )}
                </div>
              ) : item.id === 'trash' ? (
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
