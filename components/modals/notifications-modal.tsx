"use client"

import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"
import {
  IconBell,
  IconCheck,
  IconTrash,
  IconChecks,
  IconKey,
  IconShieldCheck,
  IconInfoCircle,
  IconLogin,
  IconUserCheck,
  IconFileText,
  IconCreditCard
} from "@tabler/icons-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { apiClient } from "@/lib/api"
import { useNotifications } from "@/hooks/use-notifications"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  read_at: string | null
  created_at: string
}

interface NotificationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [markingRead, setMarkingRead] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { stats, markAsRead: markAsReadGlobal, markAllAsRead: markAllAsReadGlobal, deleteNotification: deleteNotificationGlobal } = useNotifications()

  // Helper function to safely format dates
  const formatNotificationDate = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown time'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (error) {
      console.error('Error formatting date:', dateString, error)
      return 'Unknown time'
    }
  }

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getNotifications()
      if (response.success && response.data) {
        const notifs = (response.data.notifications || []) as unknown as Notification[];
        setNotifications(notifs)
        // Note: fetchStats() is called on component mount, so we don't need to call it here again
        // to avoid double API calls
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingRead(notificationId)
      await markAsReadGlobal(notificationId)

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    } finally {
      setMarkingRead(null)
    }
  }

  const markAllAsRead = async () => {
    try {
      setLoading(true)
      await markAllAsReadGlobal()

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      setDeleting(notificationId)
      const notification = notifications.find(n => n.id === notificationId)
      const wasUnread = notification ? !notification.read_at : false

      await deleteNotificationGlobal(notificationId, wasUnread)

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Failed to delete notification:', error)
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open])

  type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'security_login':
        return <IconLogin className="h-5 w-5 text-blue-600" />
      case 'security_password_change':
        return <IconKey className="h-5 w-5 text-orange-600" />
      case 'security_2fa':
        return <IconShieldCheck className="h-5 w-5 text-green-600" />
      case 'billing_payment':
        return <IconCreditCard className="h-5 w-5 text-purple-600" />
      case 'file_shared':
        return <IconFileText className="h-5 w-5 text-indigo-600" />
      case 'user_registered':
        return <IconUserCheck className="h-5 w-5 text-emerald-600" />
      default:
        return <IconInfoCircle className="h-5 w-5 text-gray-600" />
    }
  }

  const getNotificationColor = (type: string): BadgeVariant => {
    switch (type) {
      case 'security_login':
        return 'destructive'
      case 'security_password_change':
        return 'destructive'
      case 'security_2fa':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBell className="h-5 w-5" />
            Notifications
            {stats.unread > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unread} new
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Stay updated with important security events and account activity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">
            {stats.total} total notifications
          </div>
          {stats.unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <IconChecks className="h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <IconBell className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No notifications</EmptyTitle>
              <EmptyDescription>
                You&apos;re all caught up! We&apos;ll notify you of important account activity.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification, index) => (
                <div key={notification.id}>
                  <div className={`p-4 rounded-lg border transition-colors ${
                    !notification.read_at
                      ? 'bg-muted/50 border-primary/20'
                      : 'bg-background border-border'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">
                            {notification.title}
                          </h4>
                          <Badge variant={getNotificationColor(notification.type)} className="text-xs">
                            {notification.type.replace('security_', '').replace('_', ' ')}
                          </Badge>
                          {!notification.read_at && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        {notification.data && (() => {
                          const data = notification.data as Record<string, unknown> | undefined;
                          const user = data?.user as { avatar?: string; name?: string; email?: string } | undefined;
                          return (
                            <div className="text-xs text-muted-foreground space-y-1">
                              {typeof data?.ipAddress === 'string' && (
                                <div>IP: {String(data.ipAddress)}</div>
                              )}
                              {typeof data?.userAgent === 'string' && (
                                <div>Device: {String(data.userAgent).substring(0, 50)}...</div>
                              )}
                              {user && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={user.avatar || undefined}
                                      alt={user.name || user.email}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">
                                    {user.name || user.email}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatNotificationDate(notification.created_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {!notification.read_at && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                disabled={markingRead === notification.id}
                                className="h-8 px-2"
                              >
                                {markingRead === notification.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <IconCheck className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(notification.id)}
                              disabled={deleting === notification.id}
                              className="h-8 px-2 text-destructive hover:text-destructive"
                            >
                              {deleting === notification.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <IconTrash className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < notifications.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}