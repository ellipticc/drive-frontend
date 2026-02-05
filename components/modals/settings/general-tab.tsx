import React, { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
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
    IconInfoCircle,
    IconRosetteDiscountCheckFilled,
    IconSparkles,
    IconGhost2,
    IconCopy,
} from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { getDiceBearAvatar } from "@/lib/avatar"
import { getInitials } from "@/components/layout/navigation/nav-user"
import { useLanguage } from "@/lib/i18n/language-context"
import type { UserData } from "@/lib/api"

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
}: GeneralTabProps) {
    const { t } = useLanguage()

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

    const buildTime = (() => {
        const raw = process.env.NEXT_PUBLIC_BUILD_TIME || '';
        if (!raw) return 'Unknown';
        try {
            const d = isNaN(Number(raw)) ? new Date(raw) : new Date(Number(raw));
            if (isNaN(d.getTime())) return 'Unknown';
            return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + ' UTC';
        } catch (e) {
            return 'Unknown';
        }
    })();

    return (
        <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">{t('settings.general')}</h2>
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="relative group">
                        <Tooltip>
                            <TooltipTrigger asChild>
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
                            </TooltipTrigger>
                            <TooltipContent>Click to upload new avatar</TooltipContent>
                        </Tooltip>
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
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconRosetteDiscountCheckFilled className="absolute -bottom-1 -right-1 z-20 text-background size-6 bg-background rounded-full p-[1px] fill-sky-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                    {t("settings.accountInfo.verifiedUserTooltip") || "Verified Ellipticc User"}
                                </TooltipContent>
                            </Tooltip>
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


            {/* Account Info Section */}
            <div className="border-t pt-6">
                <div className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <IconGhost2 className="w-5 h-5 text-muted-foreground" />
                                <CardTitle className="text-base">{t('settings.accountInfo.label')}</CardTitle>
                            </div>
                            <CardDescription>Technical account details useful for support and debugging</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* User ID */}
                                <div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-medium">User ID</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button className="ml-1 text-muted-foreground">
                                                    <IconInfoCircle className="w-3 h-3" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs">{t('settings.accountInfo.userIdTooltip')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2">
                                        <code className="font-mono text-sm break-all">{user?.id || '—'}</code>
                                        {user?.id && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(user?.id || '')
                                                    toast.success(t('common.copied'))
                                                }}
                                                className="text-muted-foreground hover:text-foreground"
                                                title={t('settings.accountInfo.copyId') || 'Copy user ID'}
                                            >
                                                <IconCopy className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Created */}
                                <div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-medium">Created</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button className="ml-1 text-muted-foreground">
                                                    <IconInfoCircle className="w-3 h-3" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs">{t('settings.accountInfo.createdTooltip')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="text-sm text-foreground mt-2">
                                        {(user?.created_at || (user as any)?.createdAt) ? new Date(user?.created_at || (user as any)?.createdAt).toLocaleString() : '—'}
                                    </div>
                                </div>

                                {/* Bucket / Storage Region */}
                                <div>
                                    <div className="flex items-center gap-1">
                                        <div className="text-sm font-medium">Bucket region</div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button className="ml-1 text-muted-foreground">
                                                    <IconInfoCircle className="w-3 h-3" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs">{t('settings.accountInfo.regionTooltip')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="text-sm text-foreground mt-2">
                                        {user?.storage_region || '—'}
                                    </div>
                                </div>

                                {/* Crypto / API version */}
                                <div>
                                    <div className="flex items-center gap-1">
                                        <div className="text-sm font-medium">Crypto / API version</div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button className="ml-1 text-muted-foreground">
                                                    <IconInfoCircle className="w-3 h-3" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs">{t('settings.accountInfo.versionTooltip')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="text-sm font-mono text-foreground mt-2">
                                        <span className="mr-4">Crypto: {user?.crypto_version || '—'}</span>
                                        <span>API: {user?.api_version || '—'}</span>
                                    </div>


                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-4">
                        <div className="rounded-md border-l-4 border-dashed border-primary/40 bg-muted/10 p-3 flex items-start gap-3">
                            <IconInfoCircle className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                                <div className="text-sm font-medium">About Ellipticc</div>
                                <div className="text-sm text-muted-foreground mt-1">Last updated on {buildTime}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}
