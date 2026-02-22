"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconBubbleText, IconLoader2, IconMessageCircleOff } from "@tabler/icons-react"
import { useRelativeTime, cn } from "@/lib/utils"
import { sortChatsByLastMessage } from "@/lib/chat-utils"
import type { ChatType } from "@/components/layout/navigation/nav-assistant"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { ChatMessage, Message } from "@/components/ai-elements/chat-message"

// Use exactly the same as in app-sidebar.tsx
const ChatCommandItem = ({ chat, onSelect, isActive }: { chat: ChatType; onSelect: () => void; isActive?: boolean }) => {
    const timeText = useRelativeTime(chat.lastMessageAt || chat.createdAt);
    return (
        <CommandItem
            onSelect={onSelect}
            className={cn("cursor-pointer py-3", isActive && "bg-accent text-accent-foreground")}
            value={chat.title + " " + chat.id} // value for CmdK filtering
        >
            <IconBubbleText className="mr-2 h-4 w-4" />
            <span className="truncate flex-1">{chat.title}</span>
            <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">{timeText}</span>
        </CommandItem>
    );
};

export function GlobalSearch({
    open,
    onOpenChange,
    filter,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filter: 'pinned' | 'history' | null;
}) {
    const router = useRouter()
    const { chats, decryptHistory } = useAICrypto();
    const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [loading, setLoading] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const filteredChats = React.useMemo(() => {
        return sortChatsByLastMessage(chats).filter((chat: ChatType) => {
            if (filter === 'pinned') return chat.pinned && !chat.archived;
            if (filter === 'history') return !chat.pinned && !chat.archived;
            return !chat.archived;
        });
    }, [chats, filter]);

    // When active chat changes, load the preview
    React.useEffect(() => {
        if (!activeChatId || !open) {
            setMessages([]);
            return;
        }
        let isMounted = true;
        setLoading(true);
        setMessages([]);
        decryptHistory(activeChatId).then(msgs => {
            if (isMounted) {
                setMessages(msgs);
                setLoading(false);
            }
        }).catch(err => {
            console.error("Failed to decrypt chat preview", err);
            if (isMounted) setLoading(false);
        });
        return () => { isMounted = false; };
    }, [activeChatId, decryptHistory, open]);

    // Auto-scroll to bottom of preview when messages load
    React.useEffect(() => {
        if (messages.length > 0 && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Find active chat to get its title
    const activeChat = React.useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="overflow-hidden p-0 max-w-[85vw] w-[1200px] h-[80vh] flex gap-0 rounded-2xl shadow-2xl border border-border/50 bg-background/80 backdrop-blur-xl"
                showCloseButton={false}
            >
                <Command
                    className="flex flex-row w-full h-full bg-transparent"
                    shouldFilter={true}
                >
                    {/* LEFT COLUMN: Search & List */}
                    <div className="w-[350px] flex flex-col border-r border-border/50 h-full bg-sidebar/30">
                        <CommandInput
                            placeholder="Search chats..."
                            className="h-14 border-b-0"
                        />
                        <CommandList className="flex-1 overflow-y-auto h-full max-h-none">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                No results found.
                            </CommandEmpty>
                            <CommandGroup heading={filter === 'pinned' ? 'Pinned Chats' : 'Recent Chats'} className="p-2">
                                {filteredChats.map((chat) => (
                                    <ChatCommandItem
                                        key={chat.id}
                                        chat={chat}
                                        isActive={activeChatId === chat.id}
                                        onSelect={() => {
                                            // Actually navigate if they hit enter or click
                                            router.push(`/new?conversationId=${chat.id}`);
                                            onOpenChange(false);
                                        }}
                                    />
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </div>

                    {/* RIGHT COLUMN: Chat Preview (Rendered on hover/focus) */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background/50 relative">
                        {activeChatId ? (
                            <div className="flex flex-col h-full">
                                {/* Preview Header */}
                                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-background/80 backdrop-blur-sm z-10 sticky top-0">
                                    <h3 className="font-medium text-sm text-foreground truncate">{activeChat?.title || 'Preview'}</h3>
                                </div>

                                {/* Preview Content */}
                                <div
                                    ref={scrollRef}
                                    className="flex-1 overflow-y-auto p-6 space-y-6"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground/50">
                                            <IconLoader2 className="w-5 h-5 animate-spin mr-2" />
                                            Loading preview...
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground/50">
                                            Empty chat
                                        </div>
                                    ) : (
                                        messages.map((msg, i) => (
                                            <ChatMessage
                                                key={msg.id || i}
                                                message={msg}
                                                isLast={i === messages.length - 1}
                                                onCopy={() => { }}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-3">
                                <IconMessageCircleOff className="w-10 h-10 opacity-20" />
                                <p className="text-sm">Select a conversation to preview</p>
                            </div>
                        )}
                    </div>
                </Command>

                {/* Listen for keyboard navigation locally inside command to set activeChatId without selecting/submitting */}
                <KeyboardNavigator
                    filteredChats={filteredChats}
                    activeChatId={activeChatId}
                    setActiveChatId={setActiveChatId}
                />
            </DialogContent>
        </Dialog>
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
        const list = document.querySelector('[cmdk-list]');
        if (!list) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'aria-selected') {
                    const el = mutation.target as HTMLElement;
                    if (el.getAttribute('aria-selected') === 'true') {
                        const val = el.getAttribute('data-value'); // cmdk sets this to lowercased value string
                        if (val) {
                            const matchedChat = filteredChats.find(c =>
                                (c.title + " " + c.id).toLowerCase() === val
                            );
                            if (matchedChat && matchedChat.id !== activeChatId) {
                                setActiveChatId(matchedChat.id);
                            }
                        }
                    }
                }
            }
        });

        observer.observe(list, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });

        // Initial select (first item) if none selected
        if (!activeChatId && filteredChats.length > 0) {
            setActiveChatId(filteredChats[0].id);
        }

        return () => observer.disconnect();
    }, [filteredChats, activeChatId, setActiveChatId]);

    return null;
}
