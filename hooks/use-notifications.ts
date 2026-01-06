"use client"

import { useNotificationContext } from "@/components/notifications/notification-provider"

export function useNotifications() {
  const context = useNotificationContext();

  return {
    stats: context.stats,
    loading: context.loading,
    fetchStats: context.refreshStats,
    fetchUnseenStatus: context.checkUnseenStatus,
    markAsRead: context.markAsRead,
    markAllAsRead: context.markAllAsRead,
    deleteNotification: context.deleteNotification,
    hasUnread: context.hasUnread
  }
}