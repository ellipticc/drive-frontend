"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  IconFolder,
  IconFolderOpen,
  IconDotsVertical,
  IconPencil,
  IconPin,
  IconPinFilled,
  IconArchive,
  IconTrash,
} from "@tabler/icons-react"
import {
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { toast } from "sonner"

interface NavAssistantProps {
  item: {
    title: string
    url: string
    icon?: any
    id?: string
  }
}

export function NavAssistant({ item }: NavAssistantProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { chats, renameChat, pinChat, deleteChat, archiveChat } = useAICrypto()

  const [isAssistantExpanded, setIsAssistantExpanded] = React.useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("assistant-expanded") === "true"
    }
    return false
  })

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [chatToDelete, setChatToDelete] = React.useState<string | null>(null)

  // Inline Rename State
  const [editingChatId, setEditingChatId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")

  const handleNavigate = (url: string) => {
    router.push(url)
  }

  const handleRenameStart = (chat: typeof chats[0]) => {
    setEditingChatId(chat.id)
    setEditTitle(chat.title)
  }

  const handleRenameSave = async (chatId: string) => {
    if (editTitle.trim()) {
      try {
        await renameChat(chatId, editTitle.trim())
        toast.success("Chat renamed successfully")
      } catch (error) {
        console.error("Failed to rename chat:", error)
        toast.error("Failed to rename chat")
      }
    }
    setEditingChatId(null)
    setEditTitle("")
  }

  const handleDeleteClick = (chatId: string) => {
    setChatToDelete(chatId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (chatToDelete) {
      try {
        await deleteChat(chatToDelete)
        setDeleteDialogOpen(false)
        setChatToDelete(null)
        toast.success("Chat deleted")
      } catch (error) {
        console.error("Failed to delete chat:", error)
        toast.error("Failed to delete chat")
      }
    }
  }

  const handleAssistantToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newState = !isAssistantExpanded
    setIsAssistantExpanded(newState)
    sessionStorage.setItem("assistant-expanded", String(newState))
  }

  const isAssistantActive = pathname.startsWith("/new")
  const currentConversationId = searchParams.get("conversationId")

  return (
    <SidebarMenuItem key={item.id || item.title}>
      <SidebarMenuButton
        onClick={() => handleNavigate("/new")}
        tooltip={item.title}
        isActive={isAssistantActive && !currentConversationId && isAssistantExpanded}
        className="group/assist-btn pr-8"
      >
        {item.icon && <item.icon />}
        <span>{item.title}</span>
      </SidebarMenuButton>
      <div
        role="button"
        onClick={handleAssistantToggle}
        className="absolute right-1 top-1.5 p-1 rounded-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors z-20 cursor-pointer text-sidebar-foreground"
      >
        {isAssistantExpanded ? (
          <IconFolderOpen className="size-4" />
        ) : (
          <IconFolder className="size-4" />
        )}
      </div>

      {isAssistantExpanded && (
        <SidebarMenuSub className="ml-3.5 border-l border-border/50">
          {/* Unified List (Pinned first, then Recent) */}
          {chats
            .sort((a, b) => {
              if (a.pinned === b.pinned) {
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                )
              }
              return a.pinned ? -1 : 1
            })
            .filter((chat) => !chat.archived)
            .map((chat) => {
              const isEditing = editingChatId === chat.id

              return (
                <SidebarMenuSubItem
                  key={chat.id}
                  className="group/menu-sub-item relative"
                >
                  {isEditing ? (
                    <SidebarMenuSubButton
                      asChild
                      isActive={currentConversationId === chat.id}
                      className="group/chat-item pr-7 h-8"
                    >
                      <div onClick={(e) => e.preventDefault()}>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleRenameSave(chat.id)
                            if (e.key === "Escape")
                              setEditingChatId(null)
                            e.stopPropagation()
                          }}
                          onBlur={() => handleRenameSave(chat.id)}
                          autoFocus
                          className="h-6 text-xs px-1 py-0"
                        />
                      </div>
                    </SidebarMenuSubButton>
                  ) : (
                    <SidebarMenuSubButton
                      onClick={() =>
                        !isEditing &&
                        handleNavigate(`/new?conversationId=${chat.id}`)
                      }
                      isActive={currentConversationId === chat.id}
                      className="group/chat-item pr-7 h-8"
                    >
                      <Tooltip delayDuration={700}>
                        <TooltipTrigger asChild>
                          <span className="truncate flex-1 text-xs">
                            {chat.title}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-[200px] break-words"
                        >
                          {chat.title}
                        </TooltipContent>
                      </Tooltip>

                      {chat.pinned && (
                        <IconPinFilled className="size-3 text-muted-foreground mr-1 shrink-0" />
                      )}
                    </SidebarMenuSubButton>
                  )}

                  {!isEditing && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/menu-sub-item:opacity-100 transition-opacity flex gap-0.5">
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <div
                                role="button"
                                className="p-0.5 hover:bg-sidebar-accent rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconDotsVertical className="size-3.5" />
                              </div>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            More options
                          </TooltipContent>
                        </Tooltip>

                        <DropdownMenuContent
                          side="bottom"
                          align="end"
                          sideOffset={8}
                          className="w-40 origin-top-right"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRenameStart(chat)
                            }}
                          >
                            <IconPencil className="size-3.5 mr-2" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await pinChat(chat.id, !chat.pinned)
                                toast.success(
                                  chat.pinned
                                    ? "Chat unpinned"
                                    : "Chat pinned"
                                )
                              } catch (error) {
                                console.error(
                                  "Failed to toggle pin:",
                                  error
                                )
                                toast.error("Failed to update chat")
                              }
                            }}
                          >
                            {chat.pinned ? (
                              <IconPin className="size-3.5 mr-2" />
                            ) : (
                              <IconPinFilled className="size-3.5 mr-2" />
                            )}
                            <span>{chat.pinned ? "Unpin" : "Pin"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await archiveChat(chat.id, true)
                                toast.success("Chat archived")
                              } catch (error) {
                                console.error(
                                  "Failed to archive chat:",
                                  error
                                )
                                toast.error("Failed to archive chat")
                              }
                            }}
                          >
                            <IconArchive className="size-3.5 mr-2" />
                            <span>Archive</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(chat.id)
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          >
                            <IconTrash className="size-3.5 mr-2" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </SidebarMenuSubItem>
              )
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
            Are you sure you want to delete this chat? This action cannot be
            undone.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  )
}
