"use client"

import React, { useState, useRef, useCallback } from "react"
import {
  IconDotsVertical,
  IconLogout,
  IconBellRinging,
  IconSettings,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconBrightnessFilled,
  IconCheck,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { getDiceBearAvatar } from "@/lib/avatar"
import { SettingsModal } from "@/components/modals/settings-modal"
import { NotificationsModal } from "@/components/modals/notifications-modal"
import { useNotifications } from "@/hooks/use-notifications"
import { useLanguage } from "@/lib/i18n/language-context"
import { toast } from 'sonner'
import { useSettingsOpen } from "@/hooks/use-settings-open"

// Notification dot component for indicating unread notifications
function NotificationDot() {
  return (
    <div className="absolute top-0 end-0 h-2.5 w-2.5 bg-blue-500 rounded-full border-2 border-background z-10" />
  )
}

// Generate initials from name (e.g., "John Doe" -> "JD", "John" -> "J")
export function getInitials(name: string): string {
  if (!name || name.trim() === '') return 'U';

  const parts = name.trim().split(' ').filter(part => part.length > 0);
  if (parts.length === 0) return 'U';

  if (parts.length === 1) {
    // Single name: take first letter
    return parts[0].charAt(0).toUpperCase();
  } else {
    // Multiple names: take first letter of first and last name
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
}

// Get display name: use name if set, otherwise use email prefix
function getDisplayName(user: { name: string; email: string }): string {
  // If user has a display name set (not empty), use it
  if (user.name && user.name.trim() !== '') {
    return user.name.trim();
  }

  // Otherwise, use the part before "@" in the email
  const emailPrefix = user.email ? user.email.split('@')[0] : '';
  return emailPrefix || 'User';
}

export function NavUser({
  user,
  onClose,
}: {
  user: {
    id: string
    name: string
    email: string
    avatar: string
    is_checkmarked?: boolean
    show_checkmark?: boolean
    connectedDevicesCount?: number
  }
  onClose?: () => void
}) {

  const { isMobile, state } = useSidebar()
  const { t } = useLanguage()
  const { setTheme, theme } = useTheme()
  const { updateUser, refetch } = useUser()
  const [settingsOpen, setSettingsOpen] = useSettingsOpen()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { hasUnread } = useNotifications()
  const displayName = getDisplayName(user)

  // Click-to-copy for email
  const emailRef = useRef<HTMLSpanElement | null>(null)

  // Copy email to clipboard and select the text
  const handleEmailClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const email = user.email || ''
    try {
      await navigator.clipboard.writeText(email)
      toast.success('Copied email')
    } catch (err) {
      console.error('Clipboard write failed', err)
      toast.error('Failed to copy email')
    }

    // Select the email text with native browser selection
    if (emailRef.current) {
      const range = document.createRange()
      range.selectNodeContents(emailRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [user.email])

  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open)
    // Clear URL hash when closing from nav-user - use location.hash to trigger hashchange
    if (!open) {
      window.location.hash = ''
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
  }

  const handleLogout = async () => {
    try {
      await apiClient.logout()
      // Clear all sensitive data except deviceToken
      masterKeyManager.completeClearOnLogout()
      // Redirect to login page
      window.location.href = '/login'
    } catch {
      // console.error('Logout failed:', error)
      // Even if logout fails on backend, clear local tokens and data, then redirect
      apiClient.clearAuthToken()
      masterKeyManager.completeClearOnLogout()
      window.location.href = '/login'
    }
  }

  return (
    <>
      <SidebarMenu className={cn(state === 'collapsed' ? 'sticky bottom-0' : '')}>
        <SidebarMenuItem>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            {state === 'collapsed' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground relative"
                    >
                      <div className="relative">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-8 w-8 rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); window.location.hash = '#settings/General?open=avatar'; }} role="button" tabIndex={0}>
                              <AvatarImage src={user.avatar || getDiceBearAvatar(user.id)} alt={displayName} />
                              <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side="right">Change avatar</TooltipContent>
                        </Tooltip>
                        {hasUnread && <NotificationDot />}
                      </div>
                      <div className="grid flex-1 text-start text-sm leading-tight">
                        <span className="truncate font-medium">{displayName}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {user.email}
                        </span>
                      </div>
                      <IconDotsVertical className="ms-auto size-4" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{displayName}</TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground relative"
                >
                  <div className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); window.location.hash = '#settings/General?open=avatar'; }} role="button" tabIndex={0}>
                          <AvatarImage src={user.avatar || getDiceBearAvatar(user.id)} alt={displayName} />
                          <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent side="right">Change avatar</TooltipContent>
                    </Tooltip>
                    {hasUnread && <NotificationDot />}
                  </div>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                  <IconDotsVertical className="ms-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            )}

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal pointer-events-auto">
                <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                  <div className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); window.location.hash = '#settings/General?open=avatar'; }} role="button" tabIndex={0}>
                          <AvatarImage src={user.avatar || getDiceBearAvatar(user.id)} alt={displayName} />
                          <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>Change avatar</TooltipContent>
                    </Tooltip>

                  </div>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          ref={emailRef}
                          onClick={handleEmailClick}
                          role="button"
                          tabIndex={0}
                          className="text-xs truncate text-muted-foreground cursor-pointer hover:underline hover:text-foreground transition-colors"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleEmailClick(e as any)
                            }
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label="Copy email to clipboard"
                        >
                          {user.email}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Copy Address</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => {
                  const tab = 'General';
                  window.location.hash = `#settings/${tab}`;
                }}>
                  <IconSettings />
                  {t("sidebar.settings")}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setNotificationsOpen(true)}>
                  <div className="relative">
                    <IconBellRinging />
                    {hasUnread && <NotificationDot />}
                  </div>
                  {t("settings.notifications")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => {
                  window.location.hash = '#settings/Security?scroll=device-manager'
                }}>
                  <IconDeviceMobile />
                  {user.connectedDevicesCount || 1} {t("devices.connected", { defaultValue: "devices connected" })}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconBrightnessFilled className="h-4 w-4" />
                    <span>{t("theme.appearance", { defaultValue: "Appearance" })}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleThemeChange("light")}>
                      <IconSun className="mr-2 h-4 w-4" />
                      <span>{t("theme.light", { defaultValue: "Light" })}</span>
                      {theme === 'light' && <IconCheck className="ml-auto h-4 w-4 text-muted-foreground opacity-80" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
                      <IconMoon className="mr-2 h-4 w-4" />
                      <span>{t("theme.dark", { defaultValue: "Dark" })}</span>
                      {theme === 'dark' && <IconCheck className="ml-auto h-4 w-4 text-muted-foreground opacity-80" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleThemeChange("system")}>
                      <IconDeviceDesktop className="mr-2 h-4 w-4" />
                      <span>{t("theme.system", { defaultValue: "System" })}</span>
                      {theme === 'system' && <IconCheck className="ml-auto h-4 w-4 text-muted-foreground opacity-80" />}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <IconLogout />
                {t("sidebar.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  )
}
