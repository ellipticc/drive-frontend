"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { getDiceBearAvatar } from "@/lib/avatar"

interface SharedUser {
  id: string // shared_items.id
  userId: string // recipient user ID
  email: string
  name?: string
  avatar?: string
  permissions: 'read' | 'write' | 'admin'
  status: 'pending' | 'accepted' | 'declined' | 'removed'
  sharedAt?: string
}

interface SharedUsersListProps {
  users: SharedUser[]
  maxVisible?: number
  onPermissionChange?: (userId: string, permission: 'read' | 'write' | 'admin') => Promise<void>
  onRemoveAccess?: (userId: string) => Promise<void>
  onRefresh?: () => void
}

export function SharedUsersList({ 
  users, 
  maxVisible = 5, 
  onPermissionChange,
  onRemoveAccess,
  onRefresh 
}: SharedUsersListProps) {
  const [showAllModal, setShowAllModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const itemsPerPage = 10

  const visibleUsers = users.slice(0, maxVisible)
  const remainingCount = users.length - maxVisible
  
  const totalPages = Math.ceil(users.length / itemsPerPage)
  const paginatedUsers = users.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getInitials = (email: string, name?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  const handlePermissionChange = async (userId: string, permission: 'read' | 'write' | 'admin') => {
    if (!onPermissionChange) return
    setIsLoading(true)
    try {
      await onPermissionChange(userId, permission)
      toast.success('Permissions updated')
      onRefresh?.()
    } catch (error) {
      console.error('Failed to update permissions:', error)
      toast.error('Failed to update permissions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAccess = async (userId: string, email: string) => {
    if (!onRemoveAccess) return
    setIsLoading(true)
    try {
      await onRemoveAccess(userId)
      toast.success(`Removed access for ${email}`)
      onRefresh?.()
    } catch (error) {
      console.error('Failed to remove access:', error)
      toast.error('Failed to remove access')
    } finally {
      setIsLoading(false)
    }
  }

  const renderUserRow = (user: SharedUser) => (
    <div key={user.id} className="flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded-lg transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {user.avatar ? (
          <img 
            src={user.avatar} 
            alt={user.name || user.email}
            className="h-8 w-8 rounded-full flex-shrink-0"
            onError={(e) => {
              e.currentTarget.src = getDiceBearAvatar(user.userId, 32)
            }}
          />
        ) : (
          <img 
            src={getDiceBearAvatar(user.userId, 32)}
            alt={user.name || user.email}
            className="h-8 w-8 rounded-full flex-shrink-0"
          />
        )}
        <div className="flex flex-col min-w-0 flex-1">
          {user.name && (
            <span className="text-sm font-medium truncate">{user.name}</span>
          )}
          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          {user.status === 'pending' && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Pending</span>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isLoading}
          >
            <IconDotsVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => handlePermissionChange(user.id, 'read')}
            disabled={user.permissions === 'read' || isLoading}
          >
            <IconEye className="h-4 w-4 mr-2" />
            Viewer (read-only)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handlePermissionChange(user.id, 'write')}
            disabled={user.permissions === 'write' || isLoading}
          >
            <IconEdit className="h-4 w-4 mr-2" />
            Editor (read/write)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleRemoveAccess(user.id, user.email)}
            disabled={isLoading}
            className="text-destructive focus:text-destructive"
          >
            <IconTrash className="h-4 w-4 mr-2" />
            Remove access
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  if (users.length === 0) {
    return null
  }

  return (
    <>
      <div className="grid gap-1">
        {visibleUsers.map(renderUserRow)}
        {remainingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllModal(true)}
            className="justify-start text-muted-foreground hover:text-foreground"
          >
            ... {remainingCount} more
          </Button>
        )}
      </div>

      {/* All Users Modal */}
      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shared With</DialogTitle>
            <DialogDescription>
              All users who have access to this item
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1 max-h-[60vh] overflow-y-auto py-2">
            {paginatedUsers.map(renderUserRow)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
