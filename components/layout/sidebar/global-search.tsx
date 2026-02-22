"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    IconBubbleText,
    IconLoader2,
    IconExternalLink,
    IconEdit,
    IconTrash,
    IconArrowsDiagonalMinimize2,
} from "@tabler/icons-react"
import { useRelativeTime, cn } from "@/lib/utils"
import { sortChatsByLastMessage } from "@/lib/chat-utils"
import type { ChatType } from "@/components/layout/navigation/nav-assistant"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Command,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { ChatMessage, Message } from "@/components/ai-elements/chat-message"
import { toast } from "sonner"

// Helper to support tooltips on standard elements
const ActionTooltip = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => (
    <TooltipProvider>
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
)

const ChatCommandItem = ({
    chat,
    onSelect,
    isActive,
    onEdit,
    onDelete,
    onOpenNewTab,
}: {
    chat: ChatType
    onSelect: () => void
    isActive?: boolean
    onEdit: (chat: ChatType) => void
    onDelete: (chat: ChatType) => void
    onOpenNewTab: (chat: ChatType) => void
}) => {
    const timeText = useRelativeTime(chat.lastMessageAt || chat.createdAt)

    return (
        <CommandItem
            onSelect={onSelect}
            className={cn(
                "cursor-pointer py-3 group relative flex items-center gap-2",
                isActive && "bg-accent text-accent-foreground"
            )}
            value={chat.title + " " + chat.id} // value for CmdK filtering
        >
            <IconBubbleText className="shrink-0 h-4 w-4" />
            <span className="truncate flex-1">{chat.title}</span>

            {/* Timestamp (hidden on hover) */}
            <span className="ml-2 w-28 text-right text-xs text-muted-foreground whitespace-nowrap group-hover:hidden group-focus:hidden block">
                {timeText}
            </span>

            {/* Hover Actions (visible on hover) */}
            <div className="ml-2 w-28 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 hidden group-hover:flex group-focus:flex" onClick={(e) => e.stopPropagation()}>
                <ActionTooltip tooltip="New Tab">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onOpenNewTab(chat)
                        }}
                    >
                        <IconExternalLink className="h-3.5 w-3.5" />
                    </Button>
                </ActionTooltip>

                <ActionTooltip tooltip="Edit">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onEdit(chat)
                        }}
                    >
                        <IconEdit className="h-3.5 w-3.5" />
                    </Button>
                </ActionTooltip>

                <ActionTooltip tooltip="Trash">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onDelete(chat)
                        }}
                    >
                        <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                </ActionTooltip>
            </div>
        </CommandItem>
    )
}

export function GlobalSearch({
    open,
    onOpenChange,
    filter,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    filter: "pinned" | "history" | null
}) {
    const router = useRouter()
    const { chats, renameChat, deleteChat, decryptHistory } = useAICrypto()
    const [activeChatId, setActiveChatId] = React.useState<string | null>(null)

    // Modals state
    const [editingChat, setEditingChat] = React.useState<ChatType | null>(null)
    const [deletingChat, setDeletingChat] = React.useState<ChatType | null>(null)
    const [renameTitle, setRenameTitle] = React.useState("")

    // Preview Modal state
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [previewMessages, setPreviewMessages] = React.useState<Message[]>([])
    const [previewLoading, setPreviewLoading] = React.useState(false)

    const filteredChats = React.useMemo(() => {
        return sortChatsByLastMessage(chats).filter((chat: ChatType) => {
            if (filter === "pinned") return chat.pinned && !chat.archived
            if (filter === "history") return !chat.pinned && !chat.archived
            return !chat.archived
        })
    }, [chats, filter])

    // Keyboard Shortcuts (Ctrl+E, Ctrl+D)
    React.useEffect(() => {
        if (!open) return
        const down = (e: KeyboardEvent) => {
            // Don't trigger if modifiers are wrong or if focus is in an input (except our command input)
            if (e.target instanceof HTMLInputElement && e.target.id === "rename-input") return

            if (e.ctrlKey || e.metaKey) {
                if (e.key === "e") {
                    e.preventDefault()
                    if (activeChatId) {
                        const chat = filteredChats.find(c => c.id === activeChatId)
                        if (chat) handleOpenEdit(chat)
                    }
                }
                if (e.key === "d") {
                    e.preventDefault()
                    if (activeChatId) {
                        const chat = filteredChats.find(c => c.id === activeChatId)
                        if (chat) handleOpenDelete(chat)
                    }
                }
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, activeChatId, filteredChats])

    const handleOpenEdit = (chat: ChatType) => {
        setRenameTitle(chat.title)
        setEditingChat(chat)
    }

    const handleOpenDelete = (chat: ChatType) => {
        setDeletingChat(chat)
    }

    const handleOpenNewTab = (chat: ChatType) => {
        window.open(`/new?conversationId=${chat.id}`, '_blank')
        onOpenChange(false)
    }

    const handleRenameSave = async () => {
        if (!editingChat) return
        const trimmed = renameTitle.trim()
        if (!trimmed) {
            toast.error("Title cannot be empty")
            return
        }
        if (trimmed === editingChat.title) {
            setEditingChat(null)
            return
        }
        try {
            await renameChat(editingChat.id, trimmed)
            toast.success("Chat renamed")
            setEditingChat(null)
        } catch {
            toast.error("Failed to rename chat")
        }
    }

    const confirmDelete = async () => {
        if (!deletingChat) return
        try {
            await deleteChat(deletingChat.id)
            toast.success("Chat deleted")
            setDeletingChat(null)
            if (activeChatId === deletingChat.id) setActiveChatId(null)
        } catch {
            toast.error("Failed to delete chat")
        }
    }

    const openPreview = async () => {
        if (!activeChatId) return
        setPreviewOpen(true)
        setPreviewLoading(true)
        try {
            const msgs = await decryptHistory(activeChatId)
            setPreviewMessages(msgs)
        } catch (err) {
            console.error(err)
            toast.error("Failed to load preview")
        } finally {
            setPreviewLoading(false)
        }
    }

    return (
        <>
            <CommandDialog
                open={open}
                onOpenChange={(val) => {
                    onOpenChange(val)
                    if (!val) setActiveChatId(null)
                }}
                className="max-w-[85vw] w-[800px] sm:max-w-[800px] border-border/50 p-0 overflow-hidden flex flex-col"
                commandClassName="flex gap-0"
            >
                <CommandInput placeholder="Search chats..." className="h-14" />
                <CommandList className="h-[500px] overflow-y-auto w-full">
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading={filter === "pinned" ? "Pinned Chats" : "Recent Chats"}>
                        {filteredChats.map((chat) => (
                            <ChatCommandItem
                                key={chat.id}
                                chat={chat}
                                isActive={activeChatId === chat.id}
                                onSelect={() => {
                                    router.push(`/new?conversationId=${chat.id}`)
                                    onOpenChange(false)
                                }}
                                onEdit={handleOpenEdit}
                                onDelete={handleOpenDelete}
                                onOpenNewTab={handleOpenNewTab}
                            />
                        ))}
                    </CommandGroup>
                </CommandList>

                {/* Sticky Footer */}
                <div className="border-t border-border/50 bg-sidebar/50 backdrop-blur-sm p-2 flex items-center justify-between mt-auto">
                    {/* Left Side: Expand Preview */}
                    <ActionTooltip tooltip="Preview (Read-only)">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-8 px-2"
                            onClick={openPreview}
                            disabled={!activeChatId}
                        >
                            <IconArrowsDiagonalMinimize2 className="h-4 w-4" />
                        </Button>
                    </ActionTooltip>

                    {/* Right Side: Keyboard hints */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mr-2">
                        <div className="flex items-center gap-1.5">
                            <span>Open</span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                Enter
                            </kbd>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span>Edit</span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                <span className="text-[10px]">Ctrl</span>E
                            </kbd>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span>Delete</span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                <span className="text-[10px]">Ctrl</span>D
                            </kbd>
                        </div>
                    </div>
                </div>

                {/* Hidden active value tracker for cmdk */}
                <KeyboardNavigator
                    filteredChats={filteredChats}
                    activeChatId={activeChatId}
                    setActiveChatId={setActiveChatId}
                />
            </CommandDialog>

            {/* Rename Dialog */}
            <Dialog open={!!editingChat} onOpenChange={(v) => !v && setEditingChat(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Rename Chat</DialogTitle>
                    </DialogHeader>
                    <div className="py-3">
                        <Label htmlFor="rename-input" className="text-sm text-muted-foreground mb-2 block">
                            Chat title
                        </Label>
                        <Input
                            id="rename-input"
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onKeyDown={(e) => {
                                // Stop propagation so Cmd+K doesn't steal enter
                                e.stopPropagation()
                                if (e.key === "Enter") handleRenameSave()
                            }}
                            maxLength={100}
                            autoFocus
                            placeholder="Enter a title..."
                        />
                        {renameTitle.trim().length === 0 && (
                            <p className="text-xs text-destructive mt-1">Title cannot be empty</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingChat(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameSave} disabled={renameTitle.trim().length === 0}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!deletingChat} onOpenChange={(v) => !v && setDeletingChat(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Chat?</DialogTitle>
                    </DialogHeader>
                    <div className="py-2 text-sm text-muted-foreground">
                        Are you sure you want to delete this chat? This action cannot be undone.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingChat(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Full-Screen Read-Only Preview Modal */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-[90vw] w-[1200px] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
                    <DialogHeader className="p-4 border-b border-border bg-sidebar/30 backdrop-blur-md">
                        <DialogTitle className="flex items-center gap-2">
                            <IconBubbleText className="h-5 w-5 text-muted-foreground" />
                            {chats.find(c => c.id === activeChatId)?.title || "Chat Preview"}
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">Read Only</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {previewLoading ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                                <IconLoader2 className="w-6 h-6 animate-spin" />
                                <p>Loading conversation...</p>
                            </div>
                        ) : previewMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Empty chat
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto space-y-6">
                                {previewMessages.map((msg, i) => (
                                    <div key={msg.id || i} className={cn("pointer-events-none opacity-90", msg.role === 'user' ? "flex justify-end" : "flex justify-start")}>
                                        {/* Simplified read-only renderer */}
                                        <div className={cn(
                                            "px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] break-words",
                                            msg.role === 'user' ? "bg-primary text-primary-foreground" : ""
                                        )}>
                                            {msg.role === 'assistant' || msg.role === 'system' ? (
                                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                                    <ChatMessage
                                                        message={{ ...msg, isThinking: false, reasoningDuration: undefined, reasoning: undefined, suggestions: undefined, feedback: undefined }}
                                                        isLast={false}
                                                        onCopy={() => { }}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="whitespace-pre-wrap">{msg.content}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

// Invisible helper to hook onto CmdK active item changes via native DOM
function KeyboardNavigator({
    filteredChats,
    activeChatId,
    setActiveChatId
}: {
    filteredChats: ChatType[],
    activeChatId: string | null,
    setActiveChatId: (id: string | null) => void
}) {
    React.useEffect(() => {
        // CMD+K sets 'aria-selected' on items. We can watch the list via MutationObserver.
        const list = document.querySelector('[cmdk-list]')
        if (!list) return

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'aria-selected') {
                    const el = mutation.target as HTMLElement
                    if (el.getAttribute('aria-selected') === 'true') {
                        const val = el.getAttribute('data-value')
                        if (val) {
                            const matchedChat = filteredChats.find(c =>
                                (c.title + " " + c.id).toLowerCase() === val
                            )
                            if (matchedChat && matchedChat.id !== activeChatId) {
                                setActiveChatId(matchedChat.id)
                            }
                        }
                    }
                }
            }
        })

        observer.observe(list, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] })

        // Initial select (first item) if none selected
        if (!activeChatId && filteredChats.length > 0) {
            setActiveChatId(filteredChats[0].id)
        }

        return () => observer.disconnect()
    }, [filteredChats, activeChatId, setActiveChatId])

    return null
}
