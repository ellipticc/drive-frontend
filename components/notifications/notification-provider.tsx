"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import { usePathname } from "next/navigation"
import { apiClient } from "@/lib/api"

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    data: unknown;
    read_at: string | null;
    created_at: string;
}

interface NotificationStats {
    total: number
    unread: number
}

interface NotificationContextType {
    stats: NotificationStats;
    hasUnread: boolean;
    loading: boolean;
    refreshStats: () => Promise<void>;
    checkUnseenStatus: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string, wasUnread: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0 });
    const [hasUnread, setHasUnread] = useState(false);
    const [loading, setLoading] = useState(false);
    const hasFetched = useRef(false);
    const pathname = usePathname();

    // Define public routes where notification check should be skipped
    const publicRoutes = ['/login', '/signup', '/register', '/otp', '/recover', '/recover/otp', '/recover/reset', '/backup', '/totp', '/totp/recovery', '/terms-of-service', '/privacy-policy', '/billing'];
    const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/s/');

    const checkUnseenStatus = useCallback(async () => {
        if (isPublic) return; // Don't fetch on public pages
        try {
            const response = await apiClient.getUnseenStatus();
            if (response.success && response.data) {
                const hasUnseen = response.data.hasUnseen;
                setHasUnread(hasUnseen);
                // Optimistic update of unread count if we didn't have stats yet
                // Use functional update to avoid dependency on external 'stats' state
                setStats(prev => {
                    if (hasUnseen && prev.unread === 0) {
                        return { ...prev, unread: 1 };
                    } else if (!hasUnseen) {
                        return { ...prev, unread: 0 };
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error('Failed to check unseen status:', error);
        }
    }, [isPublic]);

    const refreshStats = useCallback(async () => {
        if (isPublic) return; // Don't fetch on public pages
        try {
            setLoading(true);
            const response = await apiClient.getNotifications();
            if (response.success && response.data) {
                const unreadCount = response.data.notifications.filter((n: Notification) => !n.read_at).length;
                setStats({
                    total: response.data.notifications.length,
                    unread: unreadCount
                });
                setHasUnread(unreadCount > 0);
            }
        } catch (error) {
            console.error('Failed to refresh notification stats:', error);
        } finally {
            setLoading(false);
        }
    }, [isPublic]);

    const markAsRead = async (id: string) => {
        try {
            await apiClient.markNotificationAsRead(id);
            setStats(prev => {
                const newUnread = Math.max(0, prev.unread - 1);
                if (newUnread === 0) setHasUnread(false);
                return { ...prev, unread: newUnread };
            });
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await apiClient.markAllNotificationsAsRead();
            setStats(prev => ({ ...prev, unread: 0 }));
            setHasUnread(false);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const deleteNotification = async (id: string, wasUnread: boolean) => {
        try {
            await apiClient.deleteNotification(id);
            setStats(prev => {
                const newUnread = wasUnread ? Math.max(0, prev.unread - 1) : prev.unread;
                if (newUnread === 0) setHasUnread(false);
                return {
                    total: Math.max(0, prev.total - 1),
                    unread: newUnread
                };
            });
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    useEffect(() => {
        // Fetch whenever we enter a private route and haven't fetched yet
        if (!isPublic && !hasFetched.current) {
            hasFetched.current = true;
            checkUnseenStatus();
        }
    }, [isPublic, checkUnseenStatus]);

    useEffect(() => {
        const handleLogin = () => {
            // Reset hasFetched so we re-fetch upon entering the private dashboard
            hasFetched.current = false;
            // Attempt an immediate fetch in case we're already on a private route
            checkUnseenStatus();
        };
        window.addEventListener('user-login', handleLogin);
        return () => window.removeEventListener('user-login', handleLogin);
    }, [checkUnseenStatus]);

    return (
        <NotificationContext.Provider value={{
            stats,
            hasUnread,
            loading,
            refreshStats,
            checkUnseenStatus,
            markAsRead,
            markAllAsRead,
            deleteNotification
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
}
