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
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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

  // attestations UI removed; toggle handler removed

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
                <Fragment key={item.title}>
                  <SidebarMenuItem>
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
                </Fragment>
              );
            }

            // For items after photos, use smooth transitions
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
                >
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url}
                    onClick={() => handleNavigate(item.url)}
                    className="cursor-pointer"
                  >
                    {(() => {
                      const isActive = pathname === item.url
                      const IconComponent = getIcon(item, isActive) as any
                      return IconComponent && <IconComponent />
                    })()}
                    <span>{item.title}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary px-0.5 text-[11px] font-semibold text-primary-foreground">
                        {item.badge}
                      </span>
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
                    data-space-id="root"
                    data-space-name={t("sidebar.myFiles")}
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
                        onClick={toggleMyFiles}
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

            /* attestations menu removed */

            if (item.id === 'assistant') {
              const { chats, renameChat, pinChat, deleteChat, archiveChat } = useAICrypto();
              const [isAssistantExpanded, setIsAssistantExpanded] = useState(() => {
                if (typeof window !== "undefined") {
                  return sessionStorage.getItem("assistant-expanded") === "true";
                }
                return false;
              });

              // Delete Dialog State
              const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
              const [chatToDelete, setChatToDelete] = useState<string | null>(null);

              // Inline Rename State
              const [editingChatId, setEditingChatId] = useState<string | null>(null);
              const [editTitle, setEditTitle] = useState("");

              const handleRenameStart = (chat: typeof chats[0]) => {
                setEditingChatId(chat.id);
                setEditTitle(chat.title);
              };

              const handleRenameSave = async (chatId: string) => {
                if (editTitle.trim()) {
                  try {
                    await renameChat(chatId, editTitle.trim());
                    toast.success("Chat renamed successfully");
                  } catch (error) {
                    console.error("Failed to rename chat:", error);
                    toast.error("Failed to rename chat");
                  }
                }
                setEditingChatId(null);
                setEditTitle("");
              };

              const handleDeleteClick = (chatId: string) => {
                setChatToDelete(chatId);
                setDeleteDialogOpen(true);
              };

              const confirmDelete = async () => {
                if (chatToDelete) {
                  try {
                    await deleteChat(chatToDelete);
                    setDeleteDialogOpen(false);
                    setChatToDelete(null);
                    toast.success("Chat deleted");
                  } catch (error) {
                    console.error("Failed to delete chat:", error);
                    toast.error("Failed to delete chat");
                  }
                }
              };

              const handleAssistantToggle = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const newState = !isAssistantExpanded;
                setIsAssistantExpanded(newState);
                sessionStorage.setItem("assistant-expanded", String(newState));
              }

              const isAssistantActive = pathname.startsWith('/assistant');
              const currentConversationId = searchParams.get('conversationId');

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/assistant')}
                    tooltip={item.title}
                    isActive={isAssistantActive && !currentConversationId && isAssistantExpanded}
                    className="group/assist-btn"
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <div
                      role="button"
                      onClick={handleAssistantToggle}
                      className="ml-auto p-1 rounded-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      {isAssistantExpanded ? (
                        <IconFolderOpen className="size-4" />
                      ) : (
                        <IconFolder className="size-4" />
                      )}
                    </div>
                  </SidebarMenuButton>

                  {isAssistantExpanded && (
                    <SidebarMenuSub className="ml-3.5 border-l border-border/50">

                      {/* Unified List (Pinned first, then Recent) */}
                      {chats.sort((a, b) => {
                        if (a.pinned === b.pinned) {
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        }
                        return a.pinned ? -1 : 1;
                      }).filter(chat => !chat.archived).map(chat => {
                        const isEditing = editingChatId === chat.id;

                        return (
                          <SidebarMenuSubItem key={chat.id}>
                            <SidebarMenuSubButton
                              onClick={() => !isEditing && handleNavigate(`/assistant?conversationId=${chat.id}`)}
                              isActive={currentConversationId === chat.id}
                              className="group/chat-item pr-1 h-8"
                            >
                              {isEditing ? (
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  // onClick={(e) => e.stopPropagation()} 
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSave(chat.id);
                                    if (e.key === 'Escape') setEditingChatId(null);
                                    e.stopPropagation();
                                  }}
                                  onBlur={() => handleRenameSave(chat.id)}
                                  autoFocus
                                  className="h-6 text-xs px-1 py-0"
                                />
                              ) : (
                                <>
                                  <Tooltip delayDuration={700}>
                                    <TooltipTrigger asChild>
                                      <span className="truncate flex-1 text-xs">{chat.title}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="start" className="max-w-[200px] break-words">
                                      {chat.title}
                                    </TooltipContent>
                                  </Tooltip>

                                  {chat.pinned && <IconPinFilled className="size-3 text-muted-foreground mr-1 shrink-0" />}

                                  <div className="opacity-0 group-hover/chat-item:opacity-100 flex gap-0.5 ml-auto">
                                    <DropdownMenu>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <DropdownMenuTrigger asChild>
                                            <div
                                              role="button"
                                              className="p-0.5 hover:bg-sidebar-accent rounded-sm text-muted-foreground hover:text-foreground"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <IconDotsVertical className="size-3.5" />
                                            </div>
                                          </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">More options</TooltipContent>
                                      </Tooltip>

                                      <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-40 origin-top-right">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameStart(chat); }}>
                                          <IconPencil className="size-3.5 mr-2" />
                                          <span>Rename</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); try { await pinChat(chat.id, !chat.pinned); toast.success(chat.pinned ? "Chat unpinned" : "Chat pinned"); } catch (error) { console.error("Failed to toggle pin:", error); toast.error("Failed to update chat"); } }}>
                                          {chat.pinned ? <IconPin className="size-3.5 mr-2" /> : <IconPinFilled className="size-3.5 mr-2" />}
                                          <span>{chat.pinned ? "Unpin" : "Pin"}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); try { await archiveChat(chat.id, true); toast.success("Chat archived"); } catch (error) { console.error("Failed to archive chat:", error); toast.error("Failed to archive chat"); } }}>
                                          <IconArchive className="size-3.5 mr-2" />
                                          <span>Archive</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(chat.id); }}
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                        >
                                          <IconTrash className="size-3.5 mr-2" />
                                          <span>Delete</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </>
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}

                  {/* Delete Confirmation Dialog */}
                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Chat?</DialogTitle>
                      </DialogHeader>
                      <div className="py-2 text-sm text-muted-foreground">
                        Are you sure you want to delete this chat? This action cannot be undone.
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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

            if (item.id === "settings") {
              return (
                <SidebarMenuItem key={item.title}>
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
              <SidebarMenuItem key={item.title}>
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
    </SidebarGroup>
  )
}
