import React, { useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    IconLoader2,
    IconPencil,
    IconCheck as IconCheckmark,
    IconX,
    IconLanguage,
    IconInfoCircle,
    IconRosetteDiscountCheckFilled,
} from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { getDiceBearAvatar } from "@/lib/avatar"
import { getInitials } from "@/components/layout/navigation/nav-user"
import { useLanguage } from "@/lib/i18n/language-context"
import type { UserData } from "@/lib/api"
import type { Language } from "@/lib/i18n/dictionaries"

interface GeneralTabProps {
    user: UserData | null;
    displayName: string;
    setDisplayName: (val: string) => void;
    originalName: string;
    isEditingName: boolean;
    setIsEditingName: (val: boolean) => void;
    isSavingName: boolean;
    handleSaveName: () => void;
    handleCancelEdit: () => void;
    handleAvatarClick: () => void;
    isLoadingAvatar: boolean;
    isDiceBearAvatar: boolean;
    handleRemoveAvatar: () => Promise<void>;
    nameInputRef: React.RefObject<HTMLInputElement>;
    theme: string | undefined;
    setTheme: (theme: string) => void;
    appearanceTheme: string;
    setAppearanceTheme: (theme: string) => void;
    themeSync: boolean;
    setThemeSync: (sync: boolean) => void;
    dateTimePreference: string;
    setDateTimePreference: (val: string) => void;
}

export function GeneralTab({
    user,
    displayName,
    setDisplayName,
    originalName,
    isEditingName,
    setIsEditingName,
    isSavingName,
    handleSaveName,
    handleCancelEdit,
    handleAvatarClick,
    isLoadingAvatar,
    isDiceBearAvatar,
    handleRemoveAvatar,
    nameInputRef,
    theme,
    setTheme,
    appearanceTheme,
    setAppearanceTheme,
    themeSync,
    setThemeSync,
    dateTimePreference,
    setDateTimePreference
}: GeneralTabProps) {
    const { language, setLanguage, t } = useLanguage()

    const themes = [
        { id: 'default', name: 'Default', colors: ['#ffffff', '#000000', '#f3f4f6'] },
        { id: 'mocha-mousse', name: 'Mocha Mousse', colors: ['#f3f0e9', '#a67c52', '#d9c8a9'] },
        { id: 'quantum-rose', name: 'Quantum Rose', colors: ['#fcecf1', '#e91e63', '#f8bbd0'] },
        { id: 'cosmic-night', name: 'Cosmic Night', colors: ['#922137', '#17223b', '#2e3a59'] },
        { id: 'claude', name: 'Claude', colors: ['#981805', '#267966', '#f8f1e7'] },
        { id: 'mono', name: 'Mono', colors: ['#000000', '#ffffff', '#709090'] },
        { id: 'caffeine', name: 'Caffeine', colors: ['#6f5d54', '#ffffff', '#f2f0ef'] },
        { id: 'neo-brutalism', name: 'Neo Brutalism', colors: ['#ff0000', '#ffffff', '#f4f4f4'] },
        { id: 'perpetuity', name: 'Perpetuity', colors: ['#4a8b9e', '#f2f6f7', '#edf2f3'] },
        { id: 'soft-pop', name: 'Soft Pop', colors: ['#6e44ff', '#fefbf6', '#f3f4f6'] },
        { id: 'custom', name: 'Custom Theme', colors: ['#888888', '#555555', '#333333'], comingSoon: true },
    ]

    return (
        <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">{t('settings.general')}</h2>
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="relative group">
                        <Avatar
                            className="h-20 w-20 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0"
                            onClick={handleAvatarClick}
                        >
                            <AvatarImage
                                src={user?.avatar || getDiceBearAvatar(user?.id || "user")}
                                alt="Profile"
                                onError={(e) => {
                                    // Prevent favicon.ico fallback request
                                    (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                                }}
                            />
                            <AvatarFallback className="text-base">
                                {getInitials(displayName || "User")}
                            </AvatarFallback>
                        </Avatar>
                        {isLoadingAvatar && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                <IconLoader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                        )}
                        {/* Remove avatar cross - only show for non-DiceBear avatars */}
                        {user?.avatar && !isDiceBearAvatar && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveAvatar()
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                title={t('settings.removeAvatar')}
                            >
                                <span className="text-xs font-bold">×</span>
                            </button>
                        )}
                        {user?.is_checkmarked && (
                            <IconRosetteDiscountCheckFilled className="absolute -bottom-1 -right-1 z-20 text-background size-6 bg-background rounded-full p-[1px] fill-sky-500" />
                        )}
                    </div>

                    {/* Display Name Section */}
                    <div className="flex-1 pt-1">
                        <div className="space-y-2">
                            <div>
                                <Label htmlFor="display-name" className="text-sm font-medium">
                                    {t('settings.name.label')}
                                </Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Input
                                        ref={nameInputRef}
                                        id="display-name"
                                        value={displayName}
                                        onChange={(e) => {
                                            // Strict validation: Alphanumeric and spaces only, max 50 chars
                                            const val = e.target.value
                                            if (val.length <= 50 && /^[a-zA-Z0-9 ]*$/.test(val)) {
                                                setDisplayName(val)
                                            }
                                        }}
                                        placeholder={displayName || t('settings.name.placeholder')}
                                        readOnly={!isEditingName}
                                        className={`flex-1 ${!isEditingName ? 'bg-muted cursor-not-allowed' : ''}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && isEditingName) handleSaveName()
                                            if (e.key === 'Escape' && isEditingName) handleCancelEdit()
                                        }}
                                    />
                                    {isEditingName ? (
                                        displayName === originalName ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelEdit}
                                                className="h-9 w-9 p-0"
                                                title={t('common.cancel')}
                                            >
                                                <IconX className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={handleSaveName}
                                                disabled={isSavingName || !displayName.trim()}
                                                className="h-9 w-9 p-0"
                                                title={t('common.save')}
                                            >
                                                {isSavingName ? (
                                                    <IconLoader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <IconCheckmark className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setIsEditingName(true)}
                                            className="h-9 w-9 p-0"
                                            title={t('settings.editDisplayName')}
                                        >
                                            <IconPencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Language Section */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.language.label')}</h3>
                <div className="space-y-2">
                    <Label htmlFor="language-select" className="text-sm font-medium">
                        {t('settings.language.label')}
                    </Label>
                    <div className="flex items-center gap-2">
                        <IconLanguage className="h-4 w-4 text-muted-foreground" />
                        <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                            <SelectTrigger id="language-select" className="w-full max-w-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="fr">Français</SelectItem>
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="de">Deutsch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('settings.language.desc')}
                    </p>
                </div>
            </div>

            {/* Appearance Section */}
            <div className="border-t pt-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{t('settings.appearance')}</h3>
                            <span className="text-sm font-medium text-muted-foreground ml-1">
                                Theme: <span className="text-foreground capitalize">{appearanceTheme === 'default' ? 'Ellipticc' : appearanceTheme.replace('-', ' ')}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-border transition-all">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <IconInfoCircle className="w-4 h-4 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="theme-sync" className="text-sm font-semibold cursor-pointer">
                                    Sync with system
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Automatically switch between light and dark modes
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="theme-sync"
                            checked={themeSync}
                            onCheckedChange={setThemeSync}
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        {themes.map((t) => {
                            const themeButton = (
                                <button
                                    key={t.id}
                                    onClick={() => !t.comingSoon && setAppearanceTheme(t.id)}
                                    disabled={t.comingSoon}
                                    className={cn(
                                        "relative flex flex-col gap-2 p-1 group transition-all duration-300 outline-none w-full",
                                        appearanceTheme === t.id ? "scale-[1.02]" : "hover:scale-[1.01]",
                                        t.comingSoon && "opacity-60 grayscale cursor-not-allowed"
                                    )}
                                >
                                    <div className={cn(
                                        "relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-sm",
                                        appearanceTheme === t.id
                                            ? "border-primary ring-4 ring-primary/10"
                                            : "border-muted group-hover:border-primary/40"
                                    )}>
                                        {/* Theme Preview Skeleton */}
                                        <div className="absolute inset-0 flex flex-col">
                                            <div className="h-full w-1/3 bg-foreground/10 border-r border-foreground/5"
                                                style={{ backgroundColor: t.id === 'default' ? '#f3f4f6' : t.colors[2] }}
                                            />
                                            <div className="absolute top-2 right-2 w-12 h-2 rounded-full bg-foreground/20" />
                                            <div className="absolute top-6 right-2 w-16 h-2 rounded-full bg-foreground/10" />
                                            <div className="absolute top-10 right-2 w-14 h-2 rounded-full bg-foreground/10" />
                                        </div>

                                        {/* Selection Indicator */}
                                        {appearanceTheme === t.id && (
                                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-lg">
                                                <IconCheckmark className="w-3 h-3 stroke-[3]" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-medium text-center transition-colors",
                                        appearanceTheme === t.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                    )}>
                                        {t.name}
                                    </span>
                                </button>
                            );

                            if (t.comingSoon) {
                                return (
                                    <Tooltip key={t.id}>
                                        <TooltipTrigger asChild>
                                            <div className="w-full">
                                                {themeButton}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>Coming soon</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            return themeButton;
                        })}
                    </div>

                    {!themeSync && (
                        <div className="flex items-center gap-2 pt-2">
                            <Select value={theme || "dark"} onValueChange={setTheme}>
                                <SelectTrigger id="theme-select" className="w-full max-w-[140px] rounded-xl h-9 bg-muted/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                                    <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground italic">
                                Manual mode active
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Date & Time Section */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.dateTime')}</h3>
                <div className="space-y-2">
                    <Label htmlFor="datetime-select" className="text-sm font-medium">
                        {t('settings.timeFormat.label')}
                    </Label>
                    <Select value={dateTimePreference} onValueChange={setDateTimePreference}>
                        <SelectTrigger id="datetime-select" className="w-full max-w-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="12h">{t('settings.timeFormat.12h')}</SelectItem>
                            <SelectItem value="24h">{t('settings.timeFormat.24h')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        {t('settings.timeFormat.desc')}
                    </p>
                </div>
            </div>
            {/* User ID Section */}
            <div className="border-t pt-6 flex justify-center">
                <p className="text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                    User ID: {user?.id}
                </p>
            </div>
        </div >
    )
}
