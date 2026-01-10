"use client"

import React, { useState } from "react"
import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconBellRinging,
  IconSettings,
  IconRosetteDiscountCheckFilled,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconBrightnessFilled
} from "@tabler/icons-react"

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
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { getDiceBearAvatar } from "@/lib/avatar"
import { SettingsModal } from "@/components/modals/settings-modal"
import { NotificationsModal } from "@/components/modals/notifications-modal"
import { useNotifications } from "@/hooks/use-notifications"
import { useLanguage } from "@/lib/i18n/language-context"

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
}: {
  user: {
    id: string
    name: string
    email: string
    avatar: string
    is_checkmarked?: boolean
    connectedDevicesCount?: number
  }
}) {
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const { isMobile } = useSidebar()
  const { t } = useLanguage()
  const { setTheme, theme } = useTheme()
  const { updateUser, refetch } = useUser()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { hasUnread } = useNotifications()
  const displayName = getDisplayName(user)

  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open)
    // Clear URL hash when closing from nav-user - use location.hash to trigger hashchange
    if (!open) {
      window.location.hash = ''
    }
  }

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)

    // If sync is on, disable it because user is making a manual choice
    if (user.id) { // Simple check, assumption is theme_sync might be on
      try {
        // We interact with useUser's updateUser/refetch if available, checking API logic from ThemeToggle
        await apiClient.updateProfile({ theme_sync: false });
        await refetch();
      } catch (err) {
        console.error("Failed to disable theme sync:", err);
      }
    }
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
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground relative"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar || getDiceBearAvatar(user.id)} alt={displayName} />
                    <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  {hasUnread && <NotificationDot />}
                  {user.is_checkmarked && (
                    <IconRosetteDiscountCheckFilled className="absolute -bottom-1 -right-1 z-20 text-background size-5 fill-sky-500" />
                  )}
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
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                  <div className="relative">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.avatar || getDiceBearAvatar(user.id)} alt={displayName} />
                      <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    {user.is_checkmarked && (
                      <IconRosetteDiscountCheckFilled className="absolute -bottom-1 -right-1 z-20 text-background size-5 fill-sky-500" />
                    )}
                  </div>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => {
                  window.location.hash = '#settings/General'
                }}>
                  <IconSettings />
                  {t("sidebar.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  window.location.hash = '#settings/Billing'
                }}>
                  <IconCreditCard />
                  {t("settings.billing")}
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
                    <span className="ml-2">{t("theme.appearance", { defaultValue: "Appearance" })}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleThemeChange("light")}>
                      <IconSun className="mr-2 h-4 w-4" />
                      <span>{t("theme.light", { defaultValue: "Light" })}</span>
                      {theme === 'light' && <IconRosetteDiscountCheckFilled className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
                      <IconMoon className="mr-2 h-4 w-4" />
                      <span>{t("theme.dark", { defaultValue: "Dark" })}</span>
                      {theme === 'dark' && <IconRosetteDiscountCheckFilled className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleThemeChange("system")}>
                      <IconDeviceDesktop className="mr-2 h-4 w-4" />
                      <span>{t("theme.system", { defaultValue: "System" })}</span>
                      {theme === 'system' && <IconRosetteDiscountCheckFilled className="ml-auto h-4 w-4" />}
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
      <SettingsModal open={settingsOpen} onOpenChange={handleSettingsOpenChange} />
      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  )
}
