/**
 * IndexedDB utilities for encrypted chat search indexing.
 * Stores decrypted chat metadata locally for zero-network full-text search.
 * Follows same E2EE principles: all decryption happens client-side before indexing.
 */

const DB_NAME = 'ai-chats-search';
const DB_VERSION = 1;
const STORE_NAME = 'chats';

export interface IndexedChat {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt?: string;
  pinned: boolean;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  }>;
  indexedAt: number; // Timestamp of when this was indexed
}

/**
 * Initialize IndexedDB for chat search indexing.
 * Creates DB and object stores if they don't exist.
 */
export async function initSearchIndex(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create chats object store with chatId as key
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Index by title for efficient title-based searches
        store.createIndex('title', 'title', { unique: false });
        // Index by createdAt for sorting
        store.createIndex('createdAt', 'createdAt', { unique: false });
        // Index by pinned for grouping
        store.createIndex('pinned', 'pinned', { unique: false });
      }
    };
  });
}

/**
 * Store decrypted chats in IndexedDB for full-text search.
 * Call this after decrypting all message content from API.
 */
export async function indexChats(chats: IndexedChat[]): Promise<void> {
  try {
    const db = await initSearchIndex();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear existing index
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => resolve();
    });

    // Index each chat
    for (const chat of chats) {
      const chatWithIndexTime: IndexedChat & { indexedAt: number } = {
        ...chat,
        indexedAt: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        const addReq = store.add(chatWithIndexTime);
        addReq.onerror = () => reject(addReq.error);
        addReq.onsuccess = () => resolve();
      });
    }

    db.close();
  } catch (error) {
    console.error('Failed to index chats:', error);
    throw error;
  }
}

/**
 * Search indexed chats locally without any API call.
 * Performs full-text search across titles and message content.
 * Returns results grouped with matched context.
 */
export async function searchChatsLocal(
  query: string
): Promise<
  Array<{
    chatId: string;
    chatTitle: string;
    chatCreatedAt: string;
    messageSnippet: string;
    role: 'user' | 'assistant';
    isTitle: boolean;
  }>
> {
  if (!query.trim()) return [];

  try {
    const db = await initSearchIndex();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const results: Array<{
      chatId: string;
      chatTitle: string;
      chatCreatedAt: string;
      messageSnippet: string;
      role: 'user' | 'assistant';
      isTitle: boolean;
    }> = [];

    const q = query.toLowerCase();

    // Get all chats from index
    const allChats = await new Promise<IndexedChat[]>((resolve, reject) => {
      const getAllReq = store.getAll();
      getAllReq.onerror = () => reject(getAllReq.error);
      getAllReq.onsuccess = () => resolve(getAllReq.result);
    });

    // Full-text search across titles and message content
    for (const chat of allChats) {
      // Search title
      if (chat.title.toLowerCase().includes(q)) {
        results.push({
          chatId: chat.id,
          chatTitle: chat.title,
          chatCreatedAt: chat.createdAt,
          messageSnippet: `Chat: "${chat.title}"`,
          role: 'user',
          isTitle: true,
        });
      }

      // Search messages
      for (const message of chat.messages) {
        const content = message.content.toLowerCase();
        if (content.includes(q)) {
          // Extract snippet around match (30 chars before/after)
          const matchIdx = content.indexOf(q);
          const start = Math.max(0, matchIdx - 30);
          const end = Math.min(message.content.length, matchIdx + q.length + 30);

          let snippet = message.content.substring(start, end).trim();
          if (start > 0) snippet = '...' + snippet;
          if (end < message.content.length) snippet = snippet + '...';

          results.push({
            chatId: chat.id,
            chatTitle: chat.title,
            chatCreatedAt: chat.createdAt,
            messageSnippet: snippet,
            role: message.role,
            isTitle: false,
          });
        }
      }
    }

    db.close();
    return results;
  } catch (error) {
    console.error('Failed to search chats locally:', error);
    // Graceful fallback: return empty results instead of crashing
    return [];
  }
}

/**
 * Get all indexed chats (for sidebar display, cache verification, etc.)
 */
export async function getAllIndexedChats(): Promise<IndexedChat[]> {
  try {
    const db = await initSearchIndex();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const chats = await new Promise<IndexedChat[]>((resolve, reject) => {
      const getAllReq = store.getAll();
      getAllReq.onerror = () => reject(getAllReq.error);
      getAllReq.onsuccess = () => resolve(getAllReq.result);
    });

    db.close();
    return chats;
  } catch (error) {
    console.error('Failed to get indexed chats:', error);
    return [];
  }
}

/**
 * Get paginated indexed chats ordered by createdAt desc.
 * Useful for history panels with infinite scroll.
 */
export async function getIndexedChatsPaginated(limit = 50, offset = 0): Promise<IndexedChat[]> {
  try {
    const all = await getAllIndexedChats();
    // Sort by lastMessageAt (fallback to createdAt) desc
    const sorted = all.sort((a, b) => {
        const ta = new Date(b.lastMessageAt || b.createdAt).getTime();
        const tb = new Date(a.lastMessageAt || a.createdAt).getTime();
        return ta - tb;
    });
    return sorted.slice(offset, offset + limit);
  } catch (e) {
    console.error('Failed to get paginated chats:', e);
    return [];
  }
}

/**
 * Clear entire search index (e.g., on logout or manual refresh).
 */
export async function clearSearchIndex(): Promise<void> {
  try {
    const db = await initSearchIndex();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => resolve();
    });

    db.close();
  } catch (error) {
    console.error('Failed to clear search index:', error);
  }
}

/**
 * Check if search index exists and is reasonably fresh.
 * Returns undefined if empty, or timestamp of when index was created.
 */
export async function getIndexStatus(): Promise<number | undefined> {
  try {
    const chats = await getAllIndexedChats();
    if (chats.length === 0) return undefined;
    // Return the most recent indexedAt time
    return Math.max(...chats.map((c) => c.indexedAt || 0));
  } catch {
    return undefined;
  }
}
