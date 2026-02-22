// Utility functions for chat sorting and timestamp formatting

// Sort chats by last activity (lastMessageAt) descending only - no pinned prioritization
export function sortChatsByLastMessage<T extends { pinned?: boolean; lastMessageAt?: string; createdAt?: string }>(chats: T[]): T[] {
    return [...chats].sort((a, b) => {
        // Sort strictly by timestamp, newest first. Pinned status is irrelevant.
        const ta = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
        const tb = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
        return ta - tb;
    });
}
