"use client"

import {
  IconChevronRight,
  IconLoader2,
  type Icon,
  IconChevronDown,
  IconChevronUp,
  IconStack2Filled,
  IconTrashFilled,
  IconClockHour9Filled,
  IconPhotoFilled,
  IconChartAreaLineFilled,
  IconAdjustmentsFilled,
  IconHelpCircleFilled,
  IconBubbleTextFilled,
  IconWritingSignFilled,
  IconPin,
  IconPinFilled,
  IconTrash,
  IconFolder,
  IconFolderOpen,
  IconDotsVertical,
  IconPencil,
  IconArchive,
} from "@tabler/icons-react"
import { useState, useEffect, useCallback, Fragment } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { apiClient, FolderContentItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"
import { NavFolder } from "./nav-folder"
import { NavDrafts } from "./nav-drafts"
import { NavAssistant } from "./nav-assistant"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    id?: string
    badge?: number // Optional badge count
    shortcut?: string // Keyboard shortcut
    items?: { // Nested items
      title: string;
      url: string;
      icon?: Icon;
    }[]
  }[]
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const { state, toggleSidebar } = useSidebar()
  const searchParams = useSearchParams()

  // States for "Vault" expansion
  const [isMyFilesExpanded, setIsMyFilesExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("my-files-expanded") === "true"
    }
    return false
  })

  // attestations UI removed; state previously used for attestations submenu (removed)

  const [currentHash, setCurrentHash] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentHash(window.location.hash)
      const handleHashChange = () => setCurrentHash(window.location.hash)
      window.addEventListener('hashchange', handleHashChange)
      return () => window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const [rootSubfolders, setRootSubfolders] = useState<FolderContentItem[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [hasLoadedRoot, setHasLoadedRoot] = useState(false)
  const [isMyFilesLeaf, setIsMyFilesLeaf] = useState(false)
  // const [isAttestationsLeaf, setIsAttestationsLeaf] = useState(false) // Not really used but keeps pattern

  // State for additional items expansion (after Photos) — default collapsed
  // const [areAdditionalItemsExpanded, setAreAdditionalItemsExpanded] = useState(false)  // always start collapsed

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

    // If sidebar is collapsed, expand it first
    if (state === "collapsed") {
      toggleSidebar()
      // Don't toggle the expansion state yet, just expand the sidebar
      return;
    }

    const next = !isMyFilesExpanded
    setIsMyFilesExpanded(next)
    sessionStorage.setItem("my-files-expanded", String(next))
  }

  // Helper function for sub-item icons (active state filled)
  // This helps us avoid passing 'filled' icons in the data structure
  const getSubItemIcon = (url: string, originalIcon: Icon | undefined) => {
    if (!originalIcon) return null;
    const hash = url.split('#')[1];
    if (!hash) return originalIcon;

    // Check if this item is active
    const isActive = currentHash === '#' + hash;
    if (!isActive) return originalIcon;

    switch (hash) {
      case 'Sign':
        return IconWritingSignFilled || originalIcon;
      case 'Documents':
        return IconStack2Filled || originalIcon;
      case 'Logs':
        return IconChartAreaLineFilled || originalIcon;
      default:
        return originalIcon;
    }
  }

  // Helper function to get filled icon for active states
  const getIcon = (item: { icon?: Icon; id?: string }, isActive: boolean) => {
    if (!item.icon || !isActive) return item.icon

    switch (item.id) {
      case 'my-files':
        return IconStack2Filled
      case 'recents':
        return IconClockHour9Filled
      case 'photos':
        return IconPhotoFilled
      case 'insights':
        return IconChartAreaLineFilled
      case 'trash':
        return IconTrashFilled
      case 'settings':
        return IconAdjustmentsFilled
      case 'help':
        return IconHelpCircleFilled
      case 'feedback':
        return IconBubbleTextFilled
      case 'draft':
        return IconWritingSignFilled

      default:
        return item.icon
    }
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
          {items.map((item, index) => {
            // Handle "Vault" with folder expansion
            if (item.id === 'my-files') {
              return (
                <SidebarMenuItem key={item.id || item.title} className="space-y-1">
                  <SidebarMenuButton
                    tooltip={item.shortcut ? {
                      children: (
                        <div className="flex items-center gap-2">
                          <span>{item.title}</span>
                          <Kbd>{item.shortcut}</Kbd>
                        </div>
                      )
                    } : item.title}
                    isActive={pathname === item.url}
                    onClick={(e) => {
                      if (item.url === '/vault') {
                        // Force simple navigation to vault root
                        const hasFolderId = searchParams.get('folderId');
                        if (pathname === '/vault' && !hasFolderId) return;
                        handleNavigate('/vault');
                      } else {
                        handleNavigate(item.url);
                      }
                    }}
                    className="cursor-pointer group/nav-item pr-8"
                    data-space-id="root"
                    data-space-name="Vault"
                  >
                    {(() => {
                      const isActive = pathname === item.url
                      const IconComponent = getIcon(item, isActive)
                      return IconComponent && <IconComponent className="shrink-0" />
                    })()}
                    <span>{item.title}</span>
                    {item.shortcut && (
                      <kbd className="pointer-events-none ml-auto h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-0 group-hover/nav-item:opacity-100 transition-opacity sm:inline-flex">
                        {item.shortcut}
                      </kbd>
                    )}
                    {item.badge && (
                      <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white min-w-[1.25rem]">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                  {!isMyFilesLeaf && state !== 'collapsed' && (
                    <div
                      role="button"
                      onClick={toggleMyFiles}
                      className="absolute right-1 top-1.5 p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm transition-colors text-muted-foreground/40 hover:text-muted-foreground z-20 cursor-pointer"
                    >
                      <IconChevronRight
                        className={cn("size-3.5 transition-transform duration-200", isMyFilesExpanded && "rotate-90")}
                      />
                    </div>
                  )}

                  {/* Always render submenu container for Folders */}
                  {isMyFilesExpanded && (
                    <SidebarMenuSub className="ml-3.5 border-l border-border/50">
                      {/* Dynamic Folders - Collapsible */}
                      <>
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
                      </>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            }

            if (item.id === 'assistant') {
              return <NavAssistant item={item} />
            }

            if (item.id === 'trash') {
              return (
                <SidebarMenuItem key={item.id || item.title}>
                  <SidebarMenuButton
                    tooltip={item.shortcut ? {
                      children: (
                        <div className="flex items-center gap-2">
                          <span>{item.title}</span>
                          <Kbd>{item.shortcut}</Kbd>
                        </div>
                      )
                    } : item.title}
                    isActive={pathname === item.url}
                    onClick={() => handleNavigate(item.url)}
                    className="cursor-pointer"
                    data-space-id="trash"
                    data-space-name={t("sidebar.trash")}
                  >
                    {(() => {
                      const isActive = pathname === item.url
                      const IconComponent = getIcon(item, isActive) as any
                      return IconComponent && <IconComponent />
                    })()}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            if (item.id === 'draft') {
              return <NavDrafts key={item.title} item={item} />
            }

            if (item.id === "settings") {
              return (
                <SidebarMenuItem key={item.id || item.title}>
                  <SidebarMenuButton onClick={() => window.location.hash = '#settings/General'}>
                    {(() => {
                      const IconComponent = getIcon(item, false) as any
                      return IconComponent && <IconComponent />
                    })()}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            // Default item rendering
            return (
              <SidebarMenuItem key={item.id || item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  onClick={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                  data-space-id={item.id}
                  data-space-name={item.title}
                >
                  {(() => {
                    const isActive = pathname === item.url
                    const IconComponent = getIcon(item, isActive) as any
                    return IconComponent && <IconComponent />
                  })()}
                  <span>{item.title}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary px-0.5 text-[11px] font-semibold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
