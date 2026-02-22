// Utility functions for chat sorting and timestamp formatting

// Sort chats by pinned status and last activity (lastMessageAt) descending
export function sortChatsByLastMessage<T extends { pinned?: boolean; lastMessageAt?: string; createdAt?: string }>(chats: T[]): T[] {
    return [...chats].sort((a, b) => {
        // pinned chats always come first
        if (a.pinned && !b.pinned) return -1;
        if (b.pinned && !a.pinned) return 1;

        const ta = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
        const tb = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
        return ta - tb;
    });
}
