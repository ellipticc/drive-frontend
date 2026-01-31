"use client"

import * as React from "react"
import { IconChevronRight, IconLoader2, type Icon, IconChevronDown, IconChevronUp, IconStarFilled, IconStack2Filled, IconTrashFilled, IconClockHour9Filled, IconPhotoFilled, IconChartAreaLineFilled, IconAdjustmentsFilled, IconHelpCircleFilled, IconBubbleTextFilled } from "@tabler/icons-react"
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
  }[]
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const { state } = useSidebar()
  const searchParams = useSearchParams()

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

  // State for additional items expansion (after Photos)
  const [areAdditionalItemsExpanded, setAreAdditionalItemsExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-additional-expanded") !== "false" // Default to collapsed (false)
    }
    return false
  })

  // State for More/Less button click effect
  const [isMoreLessClicked, setIsMoreLessClicked] = useState(false)

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
    // Prevent expansion if sidebar is collapsed
    if (state === "collapsed") return;

    const next = !isMyFilesExpanded
    setIsMyFilesExpanded(next)
    sessionStorage.setItem("my-files-expanded", String(next))
  }

  const toggleAdditionalItems = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Prevent toggling if sidebar is collapsed
    if (state === "collapsed") return;

    const next = !areAdditionalItemsExpanded
    setAreAdditionalItemsExpanded(next)
    localStorage.setItem("sidebar-additional-expanded", String(next))

    // Add muted click effect
    setIsMoreLessClicked(true)
  }

  // Handle click effect timeout
  useEffect(() => {
    if (isMoreLessClicked) {
      const timer = setTimeout(() => setIsMoreLessClicked(false), 150)
      return () => clearTimeout(timer)
    }
  }, [isMoreLessClicked])

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
                        isMoreLessClicked && "scale-95 opacity-70"
                      )}
                      tooltip={areAdditionalItemsExpanded ? "Show less" : "Show more"}
                    >
                      {areAdditionalItemsExpanded ? (
                        <IconChevronUp className="shrink-0 size-4" />
                      ) : (
                        <IconChevronDown className="shrink-0 size-4" />
                      )}
                      <span className="text-sm">
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
                    {item.icon && <item.icon />}
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
