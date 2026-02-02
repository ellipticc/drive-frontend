"use client"

import * as React from "react"
import { IconChevronRight, IconLoader2, type Icon, IconChevronDown, IconChevronUp, IconStarFilled, IconStack2Filled, IconTrashFilled, IconClockHour9Filled, IconPhotoFilled, IconChartAreaLineFilled, IconAdjustmentsFilled, IconHelpCircleFilled, IconBubbleTextFilled, IconWritingSignFilled } from "@tabler/icons-react"
import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
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

  // States for "My files" expansion
  const [isMyFilesExpanded, setIsMyFilesExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("my-files-expanded") === "true"
    }
    return false
  })

  const [isAttestationsExpanded, setIsAttestationsExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("attestations-expanded") === "true";
    }
    return false;
  });

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
  const [isAttestationsLeaf, setIsAttestationsLeaf] = useState(false) // Not really used but keeps pattern

  // State for additional items expansion (after Photos) — default collapsed
  const [areAdditionalItemsExpanded, setAreAdditionalItemsExpanded] = useState(false)  // always start collapsed

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

  const toggleAdditionalItems = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const next = !areAdditionalItemsExpanded
    setAreAdditionalItemsExpanded(next)
  }

  const toggleAttestations = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // If sidebar is collapsed, expand it first
    if (state === "collapsed") {
      toggleSidebar()
      // Don't toggle the expansion state yet, just expand the sidebar
      return;
    }

    const next = !isAttestationsExpanded
    setIsAttestationsExpanded(next)
    sessionStorage.setItem("attestations-expanded", String(next))
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
      case 'Keys':
        // IconDatabaseFilled not available
        return originalIcon;
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
      case 'starred':
        return IconStarFilled
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
      case 'attestations':
        // No specific filled icon for attestations yet, could use same
        return item.icon
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
            // Find the photos item index
            const photosIndex = items.findIndex(item => item.id === 'photos');
            const isAfterPhotos = photosIndex !== -1 && index > photosIndex;

            // Add the More/Less button right after photos
            if (item.id === 'photos') {
              return (
                <React.Fragment key={item.title}>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={pathname === item.url}
                      onClick={() => handleNavigate(item.url)}
                      className="cursor-pointer"
                    >
                      {(() => {
                        const isActive = pathname === item.url
                        const IconComponent = getIcon(item, isActive)
                        return IconComponent && <IconComponent />
                      })()}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* More/Less button */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={toggleAdditionalItems}
                      className={cn(
                        "cursor-pointer text-muted-foreground hover:text-foreground transition-colors",
                        state === "collapsed" && "justify-center"
                      )}
                      tooltip={areAdditionalItemsExpanded ? "Show less" : "Show more"}
                    >
                      {areAdditionalItemsExpanded ? (
                        <IconChevronUp className="shrink-0 size-4" />
                      ) : (
                        <IconChevronDown className="shrink-0 size-4" />
                      )}
                      <span className={cn(
                        "text-sm",
                        state === "collapsed" && "sr-only"
                      )}>
                        {areAdditionalItemsExpanded ? "Less" : "More"}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </React.Fragment>
              );
            }

            // For items after photos, use smooth transitions instead of conditional rendering
            if (isAfterPhotos) {
              return (
                <SidebarMenuItem
                  key={item.title}
                  className={cn(
                    "transition-all duration-300 ease-in-out overflow-hidden",
                    areAdditionalItemsExpanded
                      ? "max-h-12 opacity-100"
                      : "max-h-0 opacity-0 pointer-events-none"
                  )}
                  style={{
                    transitionProperty: 'max-height, opacity',
                    transitionDuration: '300ms',
                    transitionTimingFunction: 'ease-in-out'
                  }}
                >
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url}
                    onClick={() => handleNavigate(item.url)}
                    className="cursor-pointer"
                  >
                    {(() => {
                      const isActive = pathname === item.url
                      const IconComponent = getIcon(item, isActive)
                      return IconComponent && <IconComponent />
                    })()}
                    <span>{item.title}</span>
                    {item.badge && item.badge > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary px-0.5 text-[11px] font-semibold text-primary-foreground">
                            {item.badge}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {item.badge} pending invitation{item.badge !== 1 ? 's' : ''}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }
            if (item.id === 'my-files') {
              return (
                <SidebarMenuItem key={item.title} className="space-y-1">
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url || (item.url === '/' && pathname === '/')}
                    onClick={(e) => {
                      if (item.url === '/') {
                        // Force simple navigation to root
                        // If we are at root pathname but have a folderId, we still want to navigate to clear it
                        const hasFolderId = searchParams.get('folderId');
                        if (pathname === '/' && !hasFolderId) return; // Already at real root
                        handleNavigate('/');
                      } else {
                        handleNavigate(item.url);
                      }
                    }}
                    className="cursor-pointer relative pr-8"
                  >
                    {(() => {
                      const isActive = pathname === item.url || (item.url === '/' && pathname === '/')
                      const IconComponent = getIcon(item, isActive)
                      return IconComponent && <IconComponent className="shrink-0" />
                    })()}
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white min-w-[1.25rem]">
                        {item.badge}
                      </span>
                    )}
                    {!isMyFilesLeaf && state !== 'collapsed' && (
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

            if (item.id === 'attestations') {
              return (
                <SidebarMenuItem key={item.title} className="space-y-1">
                  <div className="relative">
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={pathname.startsWith(item.url)}
                      onClick={() => handleNavigate(item.url)}
                      className="cursor-pointer pr-8"
                    >
                      {(() => {
                        const isActive = pathname.startsWith(item.url)
                        const IconComponent = getIcon(item, isActive)
                        return IconComponent && <IconComponent className="shrink-0" />
                      })()}
                      <span>{item.title}</span>
                    </SidebarMenuButton>

                    {item.items && item.items.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleAttestations(e)
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm transition-colors text-muted-foreground/40 hover:text-muted-foreground z-50 flex items-center justify-center cursor-pointer"
                      >
                        <IconChevronRight
                          className={cn("size-3.5 shrink-0 transition-transform duration-200", isAttestationsExpanded && "rotate-90")}
                        />
                      </button>
                    )}
                  </div>

                  {isAttestationsExpanded && item.items && (
                    <SidebarMenuSub className="ml-3.5 border-l border-border/50">
                      {item.items.map((subItem) => (
                        <SidebarMenuButton
                          key={subItem.title}
                          asChild
                          isActive={currentHash === '#' + subItem.url.split('#')[1]}
                          className="text-sidebar-foreground/70 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:text-sidebar-accent-foreground h-8 min-w-8 mb-1"
                        >
                          <a href={subItem.url}>
                            {(() => {
                              const SubIcon = getSubItemIcon(subItem.url, subItem.icon)
                              return SubIcon && <SubIcon />
                            })()}
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuButton>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            }

            if (item.id === 'trash') {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url}
                    onClick={() => handleNavigate(item.url)}
                    className="cursor-pointer"
                    id="tour-trash"
                  >
                    {(() => {
                      const isActive = pathname === item.url
                      const IconComponent = getIcon(item, isActive)
                      return IconComponent && <IconComponent />
                    })()}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            if (item.id === "settings") {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton onClick={() => window.location.hash = '#settings/General'} id="tour-settings">
                    {(() => {
                      const IconComponent = getIcon(item, false) // Settings doesn't have active state in nav-main
                      return IconComponent && <IconComponent />
                    })()}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            // Default item rendering
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  onClick={() => handleNavigate(item.url)}
                  className="cursor-pointer"
                >
                  {(() => {
                    const isActive = pathname === item.url
                    const IconComponent = getIcon(item, isActive)
                    return IconComponent && <IconComponent />
                  })()}
                  <span>{item.title}</span>
                  {item.badge && item.badge > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary px-0.5 text-[11px] font-semibold text-primary-foreground">
                          {item.badge}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.badge} pending invitation{item.badge !== 1 ? 's' : ''}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup >
  )
}
