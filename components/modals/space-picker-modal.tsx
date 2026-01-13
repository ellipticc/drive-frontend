"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IconLoader2, IconPlanet, IconCheck } from "@tabler/icons-react"
import * as TablerIcons from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient, Space } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { cn } from "@/lib/utils"

interface SpacePickerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fileIds: string[]
    folderIds?: string[]
    onAdded?: () => void
}

const getSpaceColorClass = (color?: string) => {
    switch (color) {
        case 'red': return 'text-red-500';
        case 'blue': return 'text-blue-500';
        case 'green': return 'text-green-500';
        case 'yellow': return 'text-yellow-500';
        case 'purple': return 'text-purple-500';
        case 'orange': return 'text-orange-500';
        case 'pink': return 'text-pink-500';
        case 'indigo': return 'text-indigo-500';
        case 'cyan': return 'text-cyan-500';
        case 'teal': return 'text-teal-500';
        case 'lime': return 'text-lime-500';
        case 'amber': return 'text-amber-500';
        case 'stone': return 'text-stone-600';
        case 'gray': return 'text-gray-500';
        case 'slate': return 'text-slate-700';
        case 'emerald': return 'text-emerald-500';
        case 'violet': return 'text-violet-600';
        case 'fuchsia': return 'text-fuchsia-500';
        case 'rose': return 'text-rose-500';
        case 'sky': return 'text-sky-400';
        case 'zinc': return 'text-zinc-800';
        case 'white': return 'text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.5)]';
        case 'black': return 'text-black drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]';
        default: return 'text-blue-500';
    }
}

const SpaceIconRenderer = ({
    iconName,
    color,
    size = 18,
    className,
}: {
    iconName?: string;
    color?: string;
    size?: number;
    className?: string;
}) => {
    return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} style={{ width: size, height: size }}>
            {(() => {
                const TablerIcon = (iconName && (TablerIcons as any)[iconName]) || TablerIcons.IconFolder;
                const isHex = color?.startsWith('#');
                return <TablerIcon
                    size={size}
                    className={!isHex ? getSpaceColorClass(color) : ""}
                    style={isHex ? { color } : undefined}
                />;
            })()}
        </div>
    );
}

export function SpacePickerModal({ open, onOpenChange, fileIds, folderIds = [], onAdded }: SpacePickerModalProps) {
    const [spaces, setSpaces] = useState<Space[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isAdding, setIsAdding] = useState(false)

    useEffect(() => {
        if (open) {
            fetchSpaces()
        }
    }, [open])

    const fetchSpaces = async () => {
        setIsLoading(true)
        try {
            const response = await apiClient.getSpaces()
            if (response.success && response.data) {
                const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null

                const decryptedSpaces = await Promise.all(response.data.map(async (space) => {
                    let name = "Encrypted Space"
                    try {
                        if (masterKey) {
                            name = await decryptFilename(space.encrypted_name, space.name_salt, masterKey)
                        }
                    } catch (err) {
                        console.error("Failed to decrypt space name", err)
                    }
                    return { ...space, decryptedName: name }
                }))
                // Add "Spaced" (Favorites) manual entry
                const spaced: Space = {
                    id: 'spaced-fixed',
                    owner_user_id: '',
                    encrypted_name: '',
                    name_salt: '',
                    decryptedName: 'Spaced',
                    icon: 'IconPlanet',
                    color: 'blue',
                    created_at: '',
                    updated_at: ''
                }
                setSpaces([spaced, ...decryptedSpaces])
            }
        } catch (error) {
            console.error("Failed to fetch spaces", error)
            toast.error("Failed to load spaces")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelect = async (space: Space) => {
        setIsAdding(true)
        try {
            if (space.id === 'spaced-fixed') {
                const response = await apiClient.setItemStarred({
                    fileIds,
                    folderIds,
                    isStarred: true
                })
                if (response.success) {
                    toast.success("Added to Spaced")
                    onAdded?.()
                    onOpenChange(false)
                } else {
                    toast.error(response.error || "Failed to add to Spaced")
                }
            } else {
                const response = await apiClient.addItemToSpace(space.id, {
                    fileIds,
                    folderIds
                })
                if (response.success) {
                    toast.success(`Added to ${space.decryptedName}`)
                    onAdded?.()
                    onOpenChange(false)
                } else {
                    toast.error(response.error || "Failed to add to space")
                }
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add to Space</DialogTitle>
                    <DialogDescription>
                        Choose a space to add {fileIds.length + folderIds.length} item(s) to.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                            <IconLoader2 className="h-6 w-6 animate-spin" />
                            <span className="text-sm">Loading spaces...</span>
                        </div>
                    ) : spaces.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                            <IconPlanet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No spaces found. Create one in the sidebar!
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {spaces.map(space => (
                                <button
                                    key={space.id}
                                    onClick={() => handleSelect(space)}
                                    disabled={isAdding}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left group"
                                >
                                    {space.id === 'spaced-fixed' ? (
                                        <div className="bg-blue-500/10 p-2 rounded-md">
                                            <IconPlanet className="h-5 w-5 text-blue-500" />
                                        </div>
                                    ) : (
                                        <div className="bg-muted p-2 rounded-md">
                                            <SpaceIconRenderer iconName={space.icon} color={space.color} size={20} />
                                        </div>
                                    )}
                                    <span className="font-medium flex-1">
                                        {space.decryptedName}
                                    </span>
                                    {isAdding && (
                                        <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
