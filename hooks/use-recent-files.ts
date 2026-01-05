import { useState, useEffect, useCallback } from 'react';
import { apiClient, RecentItem as ApiRecentItem } from '@/lib/api';
import { decryptFilename } from '@/lib/crypto';
import { masterKeyManager } from '@/lib/master-key';

export interface RecentItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    mimeType?: string;
    size?: number;
    folderId?: string | null;
    path?: string; // For folders
    lastAccessed: number;
    is_starred?: boolean;
    is_shared?: boolean;
    encryptedName?: string;
    nameSalt?: string;
}

const STORAGE_KEY = 'drive_recent_files';
const VISIBILITY_KEY = 'drive_recent_files_visible';
const MAX_ITEMS = 15;

export function useRecentFiles(folderId?: string | null) {
    const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
    const [isVisible, setIsVisible] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const storedVisibility = localStorage.getItem(VISIBILITY_KEY);
            if (storedVisibility !== null) {
                setIsVisible(JSON.parse(storedVisibility));
            }
        } catch (e) {
            console.error('Failed to load recent files visibility', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Sync with backend on mount and when folderId changes
    useEffect(() => {
        const fetchBackendRecent = async () => {
            try {
                // Only fetch if authenticated (simple check: valid token)
                if (!apiClient.getAuthToken()) return;

                const response = await apiClient.getRecentItems(MAX_ITEMS, folderId);
                if (response.success && response.data) {

                    let masterKey: Uint8Array | null = null;
                    try {
                        masterKey = masterKeyManager.getMasterKey();
                    } catch (e) {
                        // Master key might not be ready if user just logged in and didn't unlock yet, 
                        // but usually it is. If not, we fall back to placeholders or encrypted names.
                    }

                    const mappedItems: RecentItem[] = await Promise.all(response.data.map(async (item: ApiRecentItem) => {
                        let displayName = item.name;

                        // Try to decrypt if we have encrypted name and salt and it looks encrypted
                        if (item.encryptedName && item.nameSalt && masterKey) {
                            try {
                                displayName = await decryptFilename(item.encryptedName, item.nameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt recent item ${item.id}`, err);
                            }
                        }

                        return {
                            id: item.id,
                            name: displayName,
                            type: item.type,
                            mimeType: item.mimeType,
                            size: item.size,
                            folderId: item.parentId,
                            lastAccessed: new Date(item.accessedAt).getTime(),
                            encryptedName: item.encryptedName,
                            nameSalt: item.nameSalt
                        };
                    }));

                    setRecentItems(mappedItems);
                }
            } catch (error) {
                console.error('Failed to fetch recent files from backend', error);
            }
        };

        if (isLoaded) {
            fetchBackendRecent();
        }
    }, [isLoaded, folderId]);

    // Save items to localStorage whenever they change (redundant with the effects above but good for manual updates)
    // Actually we don't need a separate effect to save to LS if we do it in setters.

    const addRecent = useCallback(async (item: Omit<RecentItem, 'lastAccessed'>, delayMs: number = 0) => {
        // Optimistic local update (immediate for UI snappiness)
        const newItem: RecentItem = {
            ...item,
            lastAccessed: Date.now()
        };

        setRecentItems(prev => {
            const filtered = prev.filter(i => i.id !== item.id);
            return [newItem, ...filtered].slice(0, MAX_ITEMS);
        });

        // Backend sync (potentially deferred)
        if (delayMs > 0) {
            setTimeout(async () => {
                try {
                    await apiClient.addRecentItem({
                        id: item.id,
                        type: item.type
                    });
                } catch (error) {
                    console.error('Failed to sync deferred recent item', error);
                }
            }, delayMs);
        } else {
            try {
                await apiClient.addRecentItem({
                    id: item.id,
                    type: item.type
                });
            } catch (error) {
                console.error('Failed to sync immediate recent item', error);
            }
        }
    }, []);

    const removeRecent = useCallback((id: string) => {
        setRecentItems(prev => {
            const updated = prev.filter(item => item.id !== id);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save recent files', e);
            }
            return updated;
        });
    }, []);

    const clearRecent = useCallback(() => {
        setRecentItems([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const toggleVisibility = useCallback(() => {
        setIsVisible(prev => {
            const next = !prev;
            localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return {
        recentItems,
        isVisible,
        isLoaded,
        addRecent,
        removeRecent,
        clearRecent,
        toggleVisibility
    };
}
