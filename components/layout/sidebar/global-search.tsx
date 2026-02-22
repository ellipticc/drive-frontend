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
    IconMaximize,
    IconMessageCircleOff,
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
import { useWindowSize } from "usehooks-ts"

// Helper to support tooltips on standard elements
const ActionTooltip = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => (
    <TooltipProvider delayDuration={300}>
        <Tooltip>
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
                isActive && "bg-accent/80 text-accent-foreground"
            )}
            value={chat.title + " " + chat.id} // value for CmdK filtering
        >
            <IconBubbleText className="shrink-0 h-4 w-4" />
            <span className="truncate flex-1">{chat.title}</span>

            {/* Timestamp (hidden on hover) */}
            <span className="ml-2 w-[88px] text-right text-xs text-muted-foreground whitespace-nowrap group-hover:hidden group-focus:hidden block">
                {timeText}
            </span>

            {/* Hover Actions (visible on hover) */}
            <div className="ml-2 w-[88px] flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 hidden group-hover:flex group-focus:flex" onClick={(e) => e.stopPropagation()}>
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
    const { width } = useWindowSize()
    const { chats, renameChat, deleteChat, decryptHistory } = useAICrypto()

    const [activeChatId, setActiveChatId] = React.useState<string | null>(null)

    // Modals state
    const [editingChat, setEditingChat] = React.useState<ChatType | null>(null)
    const [deletingChat, setDeletingChat] = React.useState<ChatType | null>(null)
    const [renameTitle, setRenameTitle] = React.useState("")

    // Expand state & Preview
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [previewMessages, setPreviewMessages] = React.useState<Message[]>([])
    const [previewLoading, setPreviewLoading] = React.useState(false)
    const scrollRef = React.useRef<HTMLDivElement>(null)

    const filteredChats = React.useMemo(() => {
        return sortChatsByLastMessage(chats).filter((chat: ChatType) => {
            if (filter === "pinned") return chat.pinned && !chat.archived
            if (filter === "history") return !chat.pinned && !chat.archived
            return !chat.archived
        })
    }, [chats, filter])

    // Real-time Preview Effect if expanded
    React.useEffect(() => {
        if (!isExpanded || !activeChatId || !open) {
            setPreviewMessages([])
            return
        }
        let isMounted = true
        setPreviewLoading(true)
        setPreviewMessages([])
        decryptHistory(activeChatId).then(msgs => {
            if (isMounted) {
                setPreviewMessages(msgs)
                setPreviewLoading(false)
            }
        }).catch(err => {
            console.error("Failed to decrypt chat preview", err)
            if (isMounted) setPreviewLoading(false)
        })
        return () => { isMounted = false }
    }, [activeChatId, decryptHistory, open, isExpanded])

    // Auto-scroll to bottom of preview when messages load
    React.useEffect(() => {
        if (isExpanded && previewMessages.length > 0 && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [previewMessages, previewLoading, isExpanded])

    const handleOpenEdit = React.useCallback((chat: ChatType) => {
        setRenameTitle(chat.title)
        setEditingChat(chat)
    }, [])

    const handleOpenDelete = React.useCallback((chat: ChatType) => {
        setDeletingChat(chat)
    }, [])

    const handleOpenNewTab = React.useCallback((chat: ChatType) => {
        window.open(`/new?conversationId=${chat.id}`, '_blank')
        onOpenChange(false)
    }, [onOpenChange])

    // Keyboard Shortcuts (Ctrl+E, Ctrl+D, Enter for Open)
    React.useEffect(() => {
        if (!open) return
        const down = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement && e.target.id === "rename-input") return

            const chat = activeChatId ? filteredChats.find(c => c.id === activeChatId) : null

            if (e.key === "Enter" && chat && !(e.ctrlKey || e.metaKey)) {
                // CmdK handles internal Enter via onSelect natively, unless overridden.
                // Doing nothing here lets CmdK process it naturally.
            } else if (e.ctrlKey || e.metaKey) {
                if (e.key === "e" && chat) {
                    e.preventDefault()
                    handleOpenEdit(chat)
                }
                if (e.key === "d" && chat) {
                    e.preventDefault()
                    handleOpenDelete(chat)
                }
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, activeChatId, filteredChats, handleOpenEdit, handleOpenDelete])

    const handleGo = () => {
        if (activeChatId) {
            router.push(`/new?conversationId=${activeChatId}`)
            onOpenChange(false)
        }
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

    const activeChat = React.useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId])

    // Dynamic Dialog Dimensions
    const isLargeScreen = width >= 1200
    const expandedWidthClass = isLargeScreen ? "w-[1200px] sm:max-w-[1200px]" : "w-[95vw] sm:max-w-[95vw]"
    const expandedHeightClass = "h-[85vh] max-h-[900px]"
    const collapsedWidthClass = "w-[800px] sm:max-w-[800px]"
    const collapsedHeightClass = "h-[600px] max-h-[85vh]"

    const dialogWidthClass = isExpanded ? expandedWidthClass : collapsedWidthClass
    const dialogHeightClass = isExpanded ? expandedHeightClass : collapsedHeightClass

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(val) => {
                    onOpenChange(val)
                    if (!val) setActiveChatId(null)
                }}
            >
                <DialogContent
                    className={cn(
                        "p-0 overflow-hidden flex flex-col gap-0 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl sm:rounded-xl transition-all duration-300",
                        dialogWidthClass,
                        dialogHeightClass
                    )}
                    showCloseButton={false}
                >
                    <Command
                        className="flex flex-col h-full w-full bg-transparent"
                        shouldFilter={true}
                    >
                        {/* TOP HEADER: Full width search bar */}
                        <div className="border-b border-border/50 relative z-10 w-full shrink-0">
                            <CommandInput
                                placeholder="Search chats..."
                                className={cn("h-14 border-none px-4", isExpanded && "h-16 text-lg")}
                            />
                        </div>

                        {/* BODY: Split Layout dynamically applied */}
                        <div className="flex flex-1 overflow-hidden">

                            {/* LEFT COLUMN: History List */}
                            <div className={cn(
                                "shrink-0 flex flex-col h-full overflow-hidden transition-all duration-300",
                                isExpanded ? "w-[350px] border-r border-border/50 bg-sidebar/50 backdrop-blur-sm" : "w-full"
                            )}>
                                <CommandList className="flex-1 overflow-y-auto w-full max-h-none py-2 px-2">
                                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                        No results found.
                                    </CommandEmpty>
                                    <CommandGroup heading={filter === "pinned" ? "Pinned" : "History"}>
                                        {filteredChats.map((chat) => (
                                            <ChatCommandItem
                                                key={chat.id}
                                                chat={chat}
                                                isActive={activeChatId === chat.id}
                                                onSelect={() => {
                                                    setActiveChatId(chat.id)
                                                    handleGo() // Navigate immediately on enter/click
                                                }}
                                                onEdit={handleOpenEdit}
                                                onDelete={handleOpenDelete}
                                                onOpenNewTab={handleOpenNewTab}
                                            />
                                        ))}
                                    </CommandGroup>
                                </CommandList>

                                {/* Sticky Footer */}
                                <div className={cn(
                                    "border-t border-border/50 flex items-center justify-between shrink-0",
                                    isExpanded ? "p-3 bg-sidebar/50" : "p-2 bg-muted/40"
                                )}>
                                    {/* Left Side: Expand Toggle */}
                                    <ActionTooltip tooltip={isExpanded ? "Collapse Preview" : "Expand Preview"}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground h-8 px-2"
                                            onClick={() => setIsExpanded(!isExpanded)}
                                        >
                                            {isExpanded ? <IconArrowsDiagonalMinimize2 className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
                                        </Button>
                                    </ActionTooltip>

                                    {/* Right Side: Keyboard hints / Clickable Actions */}
                                    <div className="flex items-center gap-1 sm:gap-2 mr-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-md flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal px-2"
                                            onClick={handleGo}
                                            disabled={!activeChatId}
                                        >
                                            <span className="text-xs">Open</span>
                                            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                                Enter
                                            </kbd>
                                        </Button>

                                        <div className="w-px h-3.5 bg-border/80 mx-0.5 hidden sm:block" />

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-md flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal px-2"
                                            onClick={() => activeChat && handleOpenEdit(activeChat)}
                                            disabled={!activeChatId}
                                        >
                                            <span className="text-xs">Edit</span>
                                            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                                <span className="text-[10px]">Ctrl</span>E
                                            </kbd>
                                        </Button>

                                        <div className="w-px h-3.5 bg-border/80 mx-0.5 hidden sm:block" />

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-md flex items-center gap-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10 font-normal px-2"
                                            onClick={() => activeChat && handleOpenDelete(activeChat)}
                                            disabled={!activeChatId}
                                        >
                                            <span className="text-xs">Delete</span>
                                            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-destructive/20 bg-destructive/10 px-1.5 font-mono text-[10px] font-medium text-destructive">
                                                <span className="text-[10px]">Ctrl</span>D
                                            </kbd>
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Real-time Preview Area (Only visible when expanded) */}
                            {isExpanded && (
                                <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                                    {activeChatId ? (
                                        <div className="flex flex-col h-full">
                                            {/* Preview Scrollable Content */}
                                            <div
                                                ref={scrollRef}
                                                className="flex-1 overflow-y-auto px-8 py-8 space-y-6"
                                            >
                                                {previewLoading ? (
                                                    <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground gap-3">
                                                        <IconLoader2 className="w-6 h-6 animate-spin opacity-50" />
                                                        <p className="text-sm">Decrypting...</p>
                                                    </div>
                                                ) : previewMessages.length === 0 ? (
                                                    <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                                                        Memory empty
                                                    </div>
                                                ) : (
                                                    <div className="max-w-4xl mx-auto space-y-8 pb-10">
                                                        <h2 className="text-2xl font-semibold mb-8 border-b pb-4 px-2 tracking-tight">{activeChat?.title}</h2>
                                                        {previewMessages.map((msg, i) => (
                                                            <div key={msg.id || i} className={cn("pointer-events-none opacity-95", msg.role === 'user' ? "flex justify-end" : "flex justify-start px-2")}>
                                                                {/* Read-only renderer */}
                                                                <div className={cn(
                                                                    "py-2 leading-relaxed max-w-[90%] break-words w-full",
                                                                    msg.role === 'user' ? "bg-primary text-primary-foreground px-5 py-3 rounded-2xl max-w-[80%]" : ""
                                                                )}>
                                                                    {msg.role === 'assistant' || msg.role === 'system' ? (
                                                                        <div className="prose prose-base dark:prose-invert max-w-none">
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
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-4">
                                            <IconMessageCircleOff className="w-12 h-12 opacity-20" />
                                            <p className="text-base font-medium">Select a conversation to instantly preview</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Hidden active value tracker for cmdk */}
                        <KeyboardNavigator
                            filteredChats={filteredChats}
                            activeChatId={activeChatId}
                            setActiveChatId={setActiveChatId}
                        />
                    </Command>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={!!editingChat} onOpenChange={(v) => !v && setEditingChat(null)}>
                <DialogContent className="sm:max-w-[400px] z-[100]">
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
                <DialogContent className="z-[100]">
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
