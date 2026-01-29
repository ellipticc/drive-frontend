"use client"

import React, { useState } from "react"
import {
    IconCreditCard,
    IconLogout,
    IconSettings,
    IconSparkles,
    IconSun,
    IconMoon,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconBrightnessFilled,
    IconStack2Filled,
    IconRosetteDiscountCheckFilled
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
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { getDiceBearAvatar } from "@/lib/avatar"
import { SettingsModal } from "@/components/modals/settings-modal"
import { useSettingsOpen } from "@/hooks/use-settings-open"
import { useLanguage } from "@/lib/i18n/language-context"

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

export function HeaderUser() {
    const { t } = useLanguage()
    const { setTheme, theme } = useTheme()
    const { user, updateUser, refetch, deviceLimitReached } = useUser()

    // Default user if context not loaded yet
    const safeUser = user || {
        id: "",
        name: "Loading...",
        email: "loading@example.com",
        avatar: getDiceBearAvatar("loading"),
        is_checkmarked: false,
        show_checkmark: true,
        connectedDevicesCount: 0
    }

    const [settingsOpen, setSettingsOpen] = useSettingsOpen()

    const displayName = getDisplayName(safeUser)

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme)
        if (safeUser.id) {
            try {
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
            masterKeyManager.completeClearOnLogout()
            window.location.href = '/login'
        } catch {
            apiClient.clearAuthToken()
            masterKeyManager.completeClearOnLogout()
            window.location.href = '/login'
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={safeUser.avatar || getDiceBearAvatar(safeUser.id)} alt={displayName} />
                            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        {safeUser.is_checkmarked && safeUser.show_checkmark !== false && (
                            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-[1px]">
                                <IconRosetteDiscountCheckFilled className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                            </div>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <div className="flex items-center gap-1.5 direction-row">
                                <p className="text-sm font-medium leading-none">{displayName}</p>
                                {safeUser.is_checkmarked && safeUser.show_checkmark !== false && (
                                    <IconRosetteDiscountCheckFilled className="size-4 text-blue-500 fill-blue-500" />
                                )}
                            </div>
                            <p className="text-xs leading-none text-muted-foreground">
                                {safeUser.email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => {
                            window.location.href = '/'
                        }}>
                            <IconStack2Filled className="mr-2 h-4 w-4" />
                            Go to Dashboard
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                            // Upgrade Workspace
                            window.location.href = '/pricing'
                        }}>
                            <IconSparkles className="mr-2 h-4 w-4" />
                            Upgrade Workspace
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                            const tab = deviceLimitReached ? 'Security?scroll=device-manager' : 'General';
                            window.location.hash = `#settings/${tab}`;
                            setSettingsOpen(true)
                        }}>
                            <IconSettings className="mr-2 h-4 w-4" />
                            {t("sidebar.settings")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                            window.location.hash = '#settings/Billing'
                            setSettingsOpen(true)
                        }}>
                            <IconCreditCard className="mr-2 h-4 w-4" />
                            {t("settings.billing")}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => {
                            window.location.hash = '#settings/Security?scroll=device-manager'
                            setSettingsOpen(true)
                        }}>
                            <IconDeviceMobile className="mr-2 h-4 w-4" />
                            {safeUser.connectedDevicesCount || 1} {t("devices.connected", { defaultValue: "devices connected" })}
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <IconBrightnessFilled className="mr-2 h-4 w-4" />
                                <span>{t("theme.appearance", { defaultValue: "Appearance" })}</span>
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
                        <IconLogout className="mr-2 h-4 w-4" />
                        {t("sidebar.logout")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
    )
}
