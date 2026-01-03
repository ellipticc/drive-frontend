import React, { useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
} from "@tabler/icons-react"
import { getDiceBearAvatar } from "@/lib/avatar"
import { getInitials } from "@/components/layout/navigation/nav-user"

interface GeneralTabProps {
    user: any;
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
    dateTimePreference,
    setDateTimePreference
}: GeneralTabProps) {
    return (
        <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">General</h2>
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
                                title="Remove avatar"
                            >
                                <span className="text-xs font-bold">×</span>
                            </button>
                        )}
                    </div>

                    {/* Display Name Section */}
                    <div className="flex-1 pt-1">
                        <div className="space-y-2">
                            <div>
                                <Label htmlFor="display-name" className="text-sm font-medium">
                                    Display name
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
                                        placeholder={displayName || "Enter your name"}
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
                                                title="Cancel"
                                            >
                                                <IconX className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={handleSaveName}
                                                disabled={isSavingName || !displayName.trim()}
                                                className="h-9 w-9 p-0"
                                                title="Save name"
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
                                            title="Edit display name"
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

            {/* Appearance Section */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Appearance</h3>
                <div className="space-y-2">
                    <Label htmlFor="theme-select" className="text-sm font-medium">
                        Theme
                    </Label>
                    <Select value={theme || "system"} onValueChange={setTheme}>
                        <SelectTrigger id="theme-select" className="w-full max-w-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Date & Time Section */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Date & Time</h3>
                <div className="space-y-2">
                    <Label htmlFor="datetime-select" className="text-sm font-medium">
                        Time format
                    </Label>
                    <Select value={dateTimePreference} onValueChange={setDateTimePreference}>
                        <SelectTrigger id="datetime-select" className="w-full max-w-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                            <SelectItem value="24h">24-hour</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        Choose how time is displayed throughout the application.
                    </p>
                </div>
            </div>
        </div>
    )
}
