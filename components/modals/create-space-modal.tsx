"use client"

import { useState, useEffect, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api"
import { encryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import * as TablerIcons from "@tabler/icons-react"
import { IconChevronDown, IconSearch } from "@tabler/icons-react"
import { useRouter } from "next/navigation"

interface CreateSpaceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSpaceCreated?: () => void
    editSpace?: { id: string; name: string; color?: string; icon?: string } | null
}

const COLORS = [
    // Standard
    { name: 'blue', class: 'bg-blue-500' },
    { name: 'red', class: 'bg-red-500' },
    { name: 'green', class: 'bg-green-500' },
    { name: 'yellow', class: 'bg-yellow-500' },
    { name: 'purple', class: 'bg-purple-500' },
    { name: 'orange', class: 'bg-orange-500' },
    { name: 'pink', class: 'bg-pink-500' },
    { name: 'indigo', class: 'bg-indigo-500' },
    { name: 'cyan', class: 'bg-cyan-500' },
    { name: 'teal', class: 'bg-teal-500' },
    { name: 'lime', class: 'bg-lime-500' },
    { name: 'amber', class: 'bg-amber-500' },
    { name: 'stone', class: 'bg-stone-600' },
    { name: 'gray', class: 'bg-gray-500' },
    { name: 'slate', class: 'bg-slate-700' },
    // Vibrants
    { name: 'emerald', class: 'bg-emerald-500' },
    { name: 'violet', class: 'bg-violet-600' },
    { name: 'fuchsia', class: 'bg-fuchsia-500' },
    { name: 'rose', class: 'bg-rose-500' },
    { name: 'sky', class: 'bg-sky-400' },
    { name: 'zinc', class: 'bg-zinc-800' },
    { name: 'white', class: 'bg-white border-muted' },
    { name: 'black', class: 'bg-black' },
]

const FEATURED_ICONS = [
    'IconFolder', 'IconFile', 'IconStar', 'IconHeart', 'IconBookmark',
    'IconArchive', 'IconBriefcase', 'IconHome', 'IconUser', 'IconSettings',
    'IconBell', 'IconCalendar', 'IconCloud', 'IconDatabase', 'IconGift',
    'IconMapPin', 'IconMusic', 'IconCamera', 'IconVideo', 'IconSun',
    'IconMoon', 'IconPalette', 'IconBolt', 'IconFlag', 'IconLock',
    'IconLockOpen', 'IconCoffee', 'IconCode', 'IconTerminal2', 'IconTarget',
    'IconTrophy', 'IconBook', 'IconShoppingBag', 'IconCreditCard',
    'IconPlane', 'IconCar', 'IconDeviceDesktop', 'IconDeviceMobile',
    'IconTool', 'IconShield', 'IconSearch', 'IconGlobe', 'IconCpu',
    'IconFlask', 'IconPaperclip', 'IconLink', 'IconTrash', 'IconAlertCircle'
]

export function CreateSpaceModal({
    open,
    onOpenChange,
    onSpaceCreated,
    editSpace = null
}: CreateSpaceModalProps) {
    const [spaceName, setSpaceName] = useState("")
    const [selectedColor, setSelectedColor] = useState("blue")
    const [selectedIcon, setSelectedIcon] = useState("IconFolder")
    const [isLoading, setIsLoading] = useState(false)
    const [isColorsOpen, setIsColorsOpen] = useState(false)
    const [isIconsOpen, setIsIconsOpen] = useState(false)
    const [iconSearch, setIconSearch] = useState("")

    useEffect(() => {
        if (open) {
            setSpaceName(editSpace?.name || "")
            setSelectedColor(editSpace?.color || "blue")
            setSelectedIcon(editSpace?.icon || "IconFolder")
            setIsColorsOpen(false)
            setIsIconsOpen(false)
            setIconSearch("")
        }
    }, [open, editSpace])

    const filteredIcons = useMemo(() => {
        if (!iconSearch.trim()) return FEATURED_ICONS;
        const search = iconSearch.toLowerCase();
        return Object.keys(TablerIcons)
            .filter(key => key.startsWith('Icon') && key.toLowerCase().includes(search))
            .slice(0, 48); // Limit to 48 for performance
    }, [iconSearch]);

    const hasChanges = () => {
        if (!editSpace) return spaceName.trim() !== ""
        return (
            spaceName.trim() !== editSpace.name ||
            selectedColor !== (editSpace.color || "blue") ||
            selectedIcon !== (editSpace.icon || "IconFolder")
        )
    }

    const router = useRouter()

    const handleSave = async () => {
        if (!spaceName.trim()) return

        if (!masterKeyManager.hasMasterKey()) {
            toast.error("Session expired. Please login again.")
            return
        }

        setIsLoading(true)
        try {
            const masterKey = masterKeyManager.getMasterKey()

            if (editSpace) {
                const updates: any = {}

                if (spaceName.trim() !== editSpace.name) {
                    const { encryptedFilename, filenameSalt } = await encryptFilename(spaceName.trim(), masterKey)
                    updates.encryptedName = encryptedFilename
                    updates.nameSalt = filenameSalt
                }

                if (selectedColor !== (editSpace.color || "blue")) {
                    updates.color = selectedColor
                }

                if (selectedIcon !== (editSpace.icon || "IconFolder")) {
                    updates.icon = selectedIcon
                }

                if (Object.keys(updates).length > 0) {
                    const response = await apiClient.renameSpace(editSpace.id, updates)
                    if (response.success) {
                        toast.success("Space updated")
                        onOpenChange(false)
                        onSpaceCreated?.()
                    } else {
                        toast.error(response.error || "Update failed")
                    }
                } else {
                    onOpenChange(false)
                }
            } else {
                const { encryptedFilename, filenameSalt } = await encryptFilename(spaceName.trim(), masterKey)
                const response = await apiClient.createSpace({
                    encryptedName: encryptedFilename,
                    nameSalt: filenameSalt,
                    icon: selectedIcon,
                    color: selectedColor
                })

                if (response.success) {
                    toast.success("Space created")
                    setSpaceName("")
                    onOpenChange(false)
                    onSpaceCreated?.()
                } else {
                    const errorData = response.data as any;
                    if (errorData?.error_code === 'SPACE_LIMIT_REACHED') {
                        toast.error(`Space limit reached`, {
                            description: `You have used ${errorData.currentUsage} of ${errorData.limit} spaces on the ${errorData.plan} plan. Upgrade to create more.`,
                            action: {
                                label: "Upgrade",
                                onClick: () => {
                                    onOpenChange(false);
                                    router.push('/pricing');
                                }
                            },
                            duration: 5000,
                        })
                    } else {
                        toast.error(response.error || "Creation failed")
                    }
                }
            }
        } catch (error) {
            toast.error("An error occurred")
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const SelectedIconComponent = (TablerIcons[selectedIcon as keyof typeof TablerIcons] as any) || TablerIcons.IconFolder

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editSpace ? "Space Settings" : "Create New Space"}</DialogTitle>
                    <DialogDescription>
                        {editSpace ? "Customize your space name, color and icon." : "Spaces help you organize files and folders for quick access."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="space-name">Space Name</Label>
                        <Input
                            id="space-name"
                            value={spaceName}
                            onChange={(e) => setSpaceName(e.target.value)}
                            placeholder="e.g. Work, Personal, Receipts"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        />
                    </div>

                    <Collapsible open={isColorsOpen} onOpenChange={setIsColorsOpen} className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label>Space Color</Label>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-9 p-0">
                                    <IconChevronDown className={cn("h-4 w-4 transition-transform duration-200", isColorsOpen && "rotate-180")} />
                                    <span className="sr-only">Toggle colors</span>
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                            <div className={cn("w-6 h-6 rounded-full", COLORS.find(c => c.name === selectedColor)?.class || "bg-blue-500")} />
                            <span className="text-sm font-medium capitalize">{selectedColor}</span>
                        </div>
                        <CollapsibleContent className="space-y-2">
                            <div className="grid grid-cols-7 gap-2 pt-2">
                                {COLORS.map((color) => (
                                    <button
                                        key={color.name}
                                        type="button"
                                        onClick={() => setSelectedColor(color.name)}
                                        className={cn(
                                            "w-full aspect-square rounded-full transition-all duration-200 border-2",
                                            color.class,
                                            selectedColor === color.name
                                                ? "border-primary scale-110 shadow-sm"
                                                : "border-transparent opacity-60 hover:opacity-100"
                                        )}
                                        title={color.name.charAt(0).toUpperCase() + color.name.slice(1)}
                                    />
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={isIconsOpen} onOpenChange={setIsIconsOpen} className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label>Space Icon</Label>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-9 p-0">
                                    <IconChevronDown className={cn("h-4 w-4 transition-transform duration-200", isIconsOpen && "rotate-180")} />
                                    <span className="sr-only">Toggle icons</span>
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                            <SelectedIconComponent className="h-5 w-5" />
                            <span className="text-sm font-medium">{selectedIcon.replace('Icon', '')}</span>
                        </div>
                        <CollapsibleContent className="space-y-3">
                            <div className="relative pt-2">
                                <IconSearch className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search icons..."
                                    value={iconSearch}
                                    onChange={(e) => setIconSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto p-1">
                                {filteredIcons.map((iconName) => {
                                    const IconComponent = (TablerIcons[iconName as keyof typeof TablerIcons] as any) || TablerIcons.IconFolder
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            onClick={() => setSelectedIcon(iconName)}
                                            className={cn(
                                                "p-2 rounded-md flex items-center justify-center transition-all duration-200 border hover:bg-muted aspect-square",
                                                selectedIcon === iconName
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-transparent text-muted-foreground"
                                            )}
                                            title={iconName.replace('Icon', '')}
                                        >
                                            <IconComponent className="h-5 w-5" />
                                        </button>
                                    )
                                })}
                                {filteredIcons.length === 0 && (
                                    <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                                        No icons found matching "{iconSearch}"
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!spaceName.trim() || isLoading || !hasChanges()}
                    >
                        {isLoading ? (editSpace ? "Saving..." : "Creating...") : (editSpace ? "Save Changes" : "Create Space")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
