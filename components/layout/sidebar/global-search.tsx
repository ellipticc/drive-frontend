"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    IconBubbleText,
    IconLoader2,
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
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { ChatMessage, Message } from "@/components/ai-elements/chat-message"
import { toast } from "sonner"
import { useWindowSize } from "usehooks-ts"

const ChatCommandItem = ({
    chat,
    onSelect,
    isActive,
}: {
    chat: ChatType
    onSelect: () => void
    isActive?: boolean
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
            <span className="ml-2 w-28 text-right text-xs text-muted-foreground whitespace-nowrap block">
                {timeText}
            </span>
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

    // Preview state
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

    // Real-time Preview Effect
    React.useEffect(() => {
        if (!activeChatId || !open) {
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
    }, [activeChatId, decryptHistory, open])

    // Auto-scroll to bottom of preview when messages load
    React.useEffect(() => {
        if (previewMessages.length > 0 && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [previewMessages, previewLoading])

    const handleOpenEdit = React.useCallback((chat: ChatType) => {
        setRenameTitle(chat.title)
        setEditingChat(chat)
    }, [])

    const handleOpenDelete = React.useCallback((chat: ChatType) => {
        setDeletingChat(chat)
    }, [])

    // Keyboard Shortcuts (Ctrl+E, Ctrl+D, Enter for Open)
    React.useEffect(() => {
        if (!open) return
        const down = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement && e.target.id === "rename-input") return

            const chat = activeChatId ? filteredChats.find(c => c.id === activeChatId) : null

            if (e.key === "Enter" && chat && !(e.ctrlKey || e.metaKey)) {
                // CmdK handles internal Enter, but if we wanted custom handling we could do it here
                // We let CmdK trigger handleGo() via onSelect internally.
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

    // Determine dialog dimensions based on screen size (Grok-like massive dialog)
    const isLargeScreen = width >= 1200
    const dialogWidthClass = isLargeScreen ? "w-[1200px]" : "w-[95vw]"
    const dialogHeightClass = "h-[85vh] max-h-[900px]"

    // If we are showing modals ON TOP of the CommandDialog, CommandDialog remains open.
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
                        "p-0 overflow-hidden flex flex-col gap-0 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl sm:rounded-2xl transition-all duration-300",
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
                        <div className="border-b border-border/50 bg-background/50 relative z-10 w-full shrink-0">
                            <CommandInput
                                placeholder="Search..."
                                className="h-16 text-lg border-none px-6"
                            />
                        </div>

                        {/* BODY: Split Layout */}
                        <div className="flex flex-1 overflow-hidden">

                            {/* LEFT COLUMN: History List */}
                            <div className="w-[350px] shrink-0 border-r border-border/50 bg-sidebar/50 backdrop-blur-sm flex flex-col h-full overflow-hidden">
                                <CommandList className="flex-1 overflow-y-auto w-full max-h-none py-2 px-2">
                                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                        No results found.
                                    </CommandEmpty>
                                    <CommandGroup heading={filter === "pinned" ? "Pinned Chats" : "Recent Chats"}>
                                        {filteredChats.map((chat) => (
                                            <ChatCommandItem
                                                key={chat.id}
                                                chat={chat}
                                                isActive={activeChatId === chat.id}
                                                onSelect={() => {
                                                    // Allow selection to just update preview if not clicking explicitly, 
                                                    // but CmdK triggers onSelect for Enter. 
                                                    setActiveChatId(chat.id)
                                                    handleGo() // Navigate immediately on enter/click
                                                }}
                                            />
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </div>

                            {/* RIGHT COLUMN: Real-time Preview Area */}
                            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative relative">
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
                                                <div className="max-w-4xl mx-auto space-y-8 pb-32">
                                                    <h2 className="text-2xl font-semibold mb-8 border-b pb-4 px-2">{activeChat?.title}</h2>
                                                    {previewMessages.map((msg, i) => (
                                                        <div key={msg.id || i} className={cn("pointer-events-none opacity-90", msg.role === 'user' ? "flex justify-end" : "flex justify-start px-2")}>
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

                                        {/* Preview Contextual Footer (Clickable Action Buttons overlaying the bottom) */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent pt-12 flex justify-end">
                                            <div className="flex items-center gap-2 bg-muted/80 backdrop-blur-md rounded-full px-4 py-2 border shadow-sm">

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 rounded-full flex items-center gap-2 hover:bg-background/80"
                                                    onClick={handleGo}
                                                >
                                                    <span className="font-medium">Go</span>
                                                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground border">
                                                        Enter
                                                    </kbd>
                                                </Button>

                                                <div className="w-px h-4 bg-border mx-1" />

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 rounded-full flex items-center gap-2 hover:bg-background/80"
                                                    onClick={() => activeChat && handleOpenEdit(activeChat)}
                                                >
                                                    <span className="font-medium">Edit</span>
                                                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground border">
                                                        <span className="text-[10px]">Ctrl</span>E
                                                    </kbd>
                                                </Button>

                                                <div className="w-px h-4 bg-border mx-1" />

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 rounded-full flex items-center gap-2 hover:bg-destructive/10 text-destructive hover:text-destructive"
                                                    onClick={() => activeChat && handleOpenDelete(activeChat)}
                                                >
                                                    <span className="font-medium">Delete</span>
                                                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-destructive/10 px-1.5 font-mono text-[10px] font-medium text-destructive border-destructive/20">
                                                        <span className="text-[10px]">Ctrl</span>D
                                                    </kbd>
                                                </Button>

                                            </div>
                                        </div>

                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-4">
                                        <IconMessageCircleOff className="w-12 h-12 opacity-20" />
                                        <p className="text-base font-medium">Select a conversation to instantly preview</p>
                                    </div>
                                )}
                            </div>
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
