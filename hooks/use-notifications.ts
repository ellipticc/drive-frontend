"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient } from "@/lib/api"

interface NotificationStats {
  total: number
  unread: number
}

export function useNotifications() {
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0 })
  const [loading, setLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const hasInitiatedFetch = useRef(false)
  const loginEventReceived = useRef(false)

  const fetchStats = useCallback(async () => {
    // Prevent double API calls - check ref first
    if (hasInitiatedFetch.current) {
      return
    }

    hasInitiatedFetch.current = true

    try {
      setLoading(true)
      const response = await apiClient.getNotifications()
      if (response.success && response.data) {
        const unreadCount = response.data.notifications.filter((n: any) => !n.read_at).length
        setStats({ total: response.data.notifications.length, unread: unreadCount })
        setHasFetched(true)
      }
    } catch (error) {
      console.error('Failed to fetch notification stats:', error)
      // Reset ref on error to allow retry
      hasInitiatedFetch.current = false
    } finally {
      setLoading(false)
    }
  }, []) // Remove loading from deps

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId)
      // Update local stats
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsAsRead()
      setStats(prev => ({ ...prev, unread: 0 }))
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }, [])

  const deleteNotification = useCallback(async (notificationId: string, wasUnread: boolean) => {
    try {
      await apiClient.deleteNotification(notificationId)
      // Update local stats
      setStats(prev => ({
        total: Math.max(0, prev.total - 1),
        unread: wasUnread ? Math.max(0, prev.unread - 1) : prev.unread
      }))
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }, [])

  // Listen for user login event to fetch initial notification stats
  useEffect(() => {
    const handleUserLogin = () => {
      loginEventReceived.current = true
      fetchStats()
    }

    window.addEventListener('user-login', handleUserLogin)

    return () => {
      window.removeEventListener('user-login', handleUserLogin)
    }
  }, [])

  useEffect(() => {
    if (!loginEventReceived.current && !hasInitiatedFetch.current) {
      fetchStats()
    }
  }, [])

  return {
    stats,
    loading,
    fetchStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    hasUnread: stats.unread > 0
  }
}