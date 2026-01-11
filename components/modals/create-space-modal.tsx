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
import * as TablerIcons from "@tabler/icons-react"
import { IconChevronDown } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import {
    ColorPicker,
    ColorPickerContent,
    ColorPickerTrigger,
    ColorPickerArea,
    ColorPickerHueSlider,
    ColorPickerAlphaSlider,
    ColorPickerInput,
    ColorPickerEyeDropper,
    ColorPickerFormatSelect,
} from "@/components/ui/color-picker"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface CreateSpaceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSpaceCreated?: () => void
    editSpace?: { id: string; name: string; color?: string; icon?: string } | null
}


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
    const [selectedColor, setSelectedColor] = useState("#3b82f6")
    const [selectedIcon, setSelectedIcon] = useState("IconFolder")
    const [isLoading, setIsLoading] = useState(false)
    const [iconSearch, setIconSearch] = useState("")
    const [isIconPopoverOpen, setIsIconPopoverOpen] = useState(false)

    useEffect(() => {
        if (open) {
            setSpaceName(editSpace?.name || "")
            setSelectedColor(editSpace?.color || "#3b82f6") // Default to blue hex
            setSelectedIcon(editSpace?.icon || "IconFolder")
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
            selectedColor.toLowerCase() !== (editSpace.color || "#3b82f6").toLowerCase() ||
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

                if (selectedColor.toLowerCase() !== (editSpace.color || "#3b82f6").toLowerCase()) {
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

                    <div className="grid gap-2">
                        <Label>Space Options</Label>
                        <div className="flex gap-3">
                            {/* COLOR PICKER */}
                            <ColorPicker value={selectedColor} onValueChange={setSelectedColor}>
                                <ColorPickerTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-12 justify-between px-3 hover:bg-accent/40 group bg-card border-muted-foreground/10"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border"
                                                style={{ backgroundColor: selectedColor }}
                                            />
                                            <div className="flex flex-col items-start gap-0.5">
                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Color</span>
                                                <span className="text-sm font-mono tabular-nums font-medium min-w-[75px]">{selectedColor.toUpperCase()}</span>
                                            </div>
                                        </div>
                                        <IconChevronDown size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </Button>
                                </ColorPickerTrigger>
                                <ColorPickerContent className="w-[360]">
                                    <ColorPickerArea />
                                    <div className="flex items-center gap-2">
                                        <ColorPickerEyeDropper />
                                        <div className="flex flex-1 flex-col gap-2">
                                            <ColorPickerHueSlider />
                                            <ColorPickerAlphaSlider />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ColorPickerFormatSelect />
                                        <ColorPickerInput />
                                    </div>
                                </ColorPickerContent>
                            </ColorPicker>

                            {/* ICON PICKER */}
                            <Popover open={isIconPopoverOpen} onOpenChange={setIsIconPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-12 justify-between px-3 hover:bg-accent/40 group bg-card border-muted-foreground/10"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                                                <SelectedIconComponent className="w-5 h-5" style={{ color: selectedColor }} />
                                            </div>
                                            <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Icon</span>
                                                <span className="text-sm font-medium truncate">{selectedIcon.replace('Icon', '')}</span>
                                            </div>
                                        </div>
                                        <IconChevronDown size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Search icons..."
                                            value={iconSearch}
                                            onValueChange={setIconSearch}
                                        />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty>No icons found.</CommandEmpty>
                                            <CommandGroup
                                                heading="Icons"
                                                className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-5 [&_[cmdk-group-items]]:gap-1 [&_[cmdk-group-items]]:p-2"
                                            >
                                                {filteredIcons.map((iconName) => {
                                                    const IconComponent = (TablerIcons[iconName as keyof typeof TablerIcons] as any) || TablerIcons.IconFolder
                                                    return (
                                                        <CommandItem
                                                            key={iconName}
                                                            value={iconName}
                                                            onSelect={() => {
                                                                setSelectedIcon(iconName)
                                                                setIsIconPopoverOpen(false)
                                                            }}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center p-2 rounded-md transition-all cursor-pointer aspect-square border-0 aria-selected:bg-primary/10 aria-selected:text-primary",
                                                                selectedIcon === iconName && "bg-primary/10 text-primary ring-2 ring-primary ring-inset"
                                                            )}
                                                        >
                                                            <IconComponent className="h-5 w-5" />
                                                            <span className="sr-only">{iconName}</span>
                                                        </CommandItem>
                                                    )
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
                <DialogFooter className="gap-2">
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
