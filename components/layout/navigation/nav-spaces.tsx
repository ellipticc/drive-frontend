"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
    IconPlus,
    IconTrash,
    IconEdit,
    IconChevronRight,
    IconDotsVertical,
    IconArrowsMove,
    IconGripVertical,
    IconPlus as IconAdd,
    IconPlanet,
    IconSpace,
} from "@tabler/icons-react"
import * as TablerIcons from "@tabler/icons-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    useSidebar,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers"

import { apiClient } from "@/lib/api"
import type { Space, SpaceItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { CreateSpaceModal } from "@/components/modals/create-space-modal"
import { AddToSpaceModal } from "@/components/modals/add-to-space-modal"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileIcon } from "@/components/file-icon"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

function TruncatedTooltip({ children, text }: { children: React.ReactNode, text: string }) {
    const [isTruncated, setIsTruncated] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const checkTruncation = () => {
            if (ref.current) {
                setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
            }
        };
        checkTruncation();
        window.addEventListener('resize', checkTruncation);
        return () => window.removeEventListener('resize', checkTruncation);
    }, [text]);

    if (!isTruncated) {
        return <span ref={ref} className="truncate">{children}</span>;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span ref={ref} className="truncate cursor-default">{children}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[300px] break-all">
                {text}
            </TooltipContent>
        </Tooltip>
    );
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
    isSpaced = false
}: {
    iconName?: string;
    color?: string;
    size?: number;
    className?: string;
    isSpaced?: boolean;
}) => {
    return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} style={{ width: size, height: size }}>
            {isSpaced ? (
                <IconPlanet size={size} className="text-blue-500" />
            ) : (() => {
                const TablerIcon = (iconName && (TablerIcons as any)[iconName]) || TablerIcons.IconFolder;
                return <TablerIcon size={size} className={getSpaceColorClass(color)} />;
            })()}
        </div>
    );
}

function SortableSpaceItem({
    space,
    onFetchItems,
    onEdit,
    onDelete,
    onAdd,
    onItemClick,
    onRemoveItem,
    onMoveItem,
    onNewSpace,
    spaces,
    isSpaced = false
}: {
    space: Space & { items?: SpaceItem[] },
    onFetchItems: (id: string) => void,
    onEdit?: (space: any) => void,
    onDelete?: (space: any) => void,
    onAdd: (space: any) => void,
    onItemClick: (e: any, item: any) => void,
    onRemoveItem: (spaceId: string, itemId: string) => void,
    onMoveItem: (spaceId: string, itemId: string, targetId: string) => void,
    onNewSpace: () => void,
    spaces: Space[],
    isSpaced?: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: space.id, disabled: isSpaced });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    const { isMobile } = useSidebar()

    return (
        <div ref={setNodeRef} style={style} className="relative">
            <Collapsible
                asChild
                className="group/collapsible"
                onOpenChange={(isOpen) => isOpen && onFetchItems(space.id)}
            >
                <SidebarMenuItem>
                    <div className="flex items-center w-full group/item relative cursor-default hover:bg-accent/40 rounded-md transition-all px-0.5 py-0.5 ml-[-12px]">
                        {/* DRAG HANDLE ALIGNMENT - Ultra-compact for maximum left alignment */}
                        <div className="w-4 flex-shrink-0 flex items-center justify-center">
                            {!isSpaced && (
                                <div
                                    {...attributes}
                                    {...listeners}
                                    className="opacity-0 group-hover/item:opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing p-1 transition-opacity"
                                >
                                    <IconGripVertical size={14} />
                                </div>
                            )}
                        </div>

                        <SidebarMenuButton
                            tooltip={space.decryptedName || "Space"}
                            asChild
                            className="flex-1 min-w-0 bg-transparent hover:bg-transparent p-0 h-9"
                        >
                            <CollapsibleTrigger asChild>
                                <button className="flex items-center w-full h-full text-left">
                                    <IconChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/40 shrink-0" size={12} />
                                    <SpaceIconRenderer iconName={space.icon} color={space.color} isSpaced={isSpaced} />
                                    <span className="ml-1 font-medium truncate flex-1 text-sm">{space.decryptedName || "Encrypted Space"}</span>
                                </button>
                            </CollapsibleTrigger>
                        </SidebarMenuButton>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 ml-1 shrink-0 pr-1">
                            {/* + BUTTON DROPDOWN */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="hover:bg-accent rounded-sm h-6 w-6 flex items-center justify-center cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        <IconPlus size={14} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onClick={onNewSpace}>
                                        <IconPlanet className="mr-2 h-4 w-4" />
                                        <span>New Space</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAdd({ id: space.id, name: space.decryptedName || "Space" })}>
                                        <IconAdd className="mr-2 h-4 w-4" />
                                        <span>Add Item</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {!isSpaced && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="hover:bg-accent data-[state=open]:bg-accent rounded-sm h-6 w-6 flex items-center justify-center cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <IconDotsVertical size={14} />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="w-40 rounded-lg"
                                        side={isMobile ? "bottom" : "right"}
                                        align={isMobile ? "end" : "start"}
                                    >
                                        <DropdownMenuItem onClick={() => onEdit?.({
                                            id: space.id,
                                            name: space.decryptedName || "",
                                            color: space.color,
                                            icon: space.icon
                                        })}>
                                            <IconEdit className="mr-2 h-4 w-4" />
                                            <span>Settings</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => onDelete?.({ id: space.id, name: space.decryptedName || "Space" })}
                                        >
                                            <IconTrash className="mr-2 h-4 w-4" />
                                            <span>Delete</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    <CollapsibleContent>
                        {(space.items || []).length > 0 && (
                            <SidebarMenuSub className="ml-8 mr-0 border-l border-border/50">
                                {space.items?.map((item) => (
                                    <SidebarMenuSubItem key={item.id} className="group/subitem relative">
                                        <SidebarMenuSubButton asChild>
                                            <div className="flex items-center w-full min-w-0 pr-6">
                                                <button
                                                    onClick={(e) => onItemClick(e, item)}
                                                    className="flex items-center gap-2 w-full min-w-0 h-full text-left"
                                                >
                                                    {item.file_id ? (
                                                        <FileIcon filename={item.decryptedName} className="h-4 w-4 shrink-0" />
                                                    ) : (
                                                        <TablerIcons.IconFolder size={14} className="text-blue-500 shrink-0" />
                                                    )}
                                                    <TruncatedTooltip text={item.decryptedName || ""}>
                                                        <span className="text-xs font-normal">
                                                            {item.decryptedName || "Encrypted Item"}
                                                        </span>
                                                    </TruncatedTooltip>
                                                </button>
                                            </div>
                                        </SidebarMenuSubButton>

                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/subitem:opacity-100 flex items-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="p-1 hover:bg-accent rounded-sm transition-colors text-muted-foreground">
                                                        <IconDotsVertical size={12} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent side="right" align="start" className="w-48">
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>
                                                            <IconArrowsMove className="mr-2 h-4 w-4" />
                                                            <span>Move to Space</span>
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuSubContent className="w-48">
                                                                {/* Starred (Spaced) target */}
                                                                {space.id !== "spaced-fixed" && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => onMoveItem(space.id, item.id, "spaced-fixed")}
                                                                    >
                                                                        <SpaceIconRenderer isSpaced={true} size={14} />
                                                                        <span className="ml-2 truncate">Spaced</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {spaces.filter(s => s.id !== space.id).map(targetSpace => (
                                                                    <DropdownMenuItem
                                                                        key={targetSpace.id}
                                                                        onClick={() => onMoveItem(space.id, item.id, targetSpace.id)}
                                                                    >
                                                                        <SpaceIconRenderer iconName={targetSpace.icon} color={targetSpace.color} size={14} />
                                                                        <span className="ml-2 truncate">{targetSpace.decryptedName}</span>
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuPortal>
                                                    </DropdownMenuSub>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => onRemoveItem(space.id, item.id)}
                                                    >
                                                        <IconTrash className="mr-2 h-4 w-4" />
                                                        <span>Remove from Space</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </SidebarMenuSubItem>
                                ))}
                            </SidebarMenuSub>
                        )}
                    </CollapsibleContent>
                </SidebarMenuItem>
            </Collapsible>
        </div>
    );
}

export function NavSpaces() {
    const router = useRouter()
    const [spaces, setSpaces] = useState<Space[]>([])
    const [spacedSpace, setSpacedSpace] = useState<Space & { items?: SpaceItem[] }>({
        id: "spaced-fixed",
        owner_user_id: "",
        encrypted_name: "",
        name_salt: "",
        decryptedName: "Spaced",
        icon: "IconPlanet",
        color: "blue",
        created_at: "",
        updated_at: "",
        items: []
    })
    const [isLoading, setIsLoading] = useState(true)

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [selectedSpace, setSelectedSpace] = useState<{ id: string; name: string } | null>(null)
    const [editSpace, setEditSpace] = useState<{ id: string; name: string; color?: string; icon?: string } | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchSpaces = useCallback(async () => {
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
                    return { ...space, decryptedName: name, items: [] }
                }))
                setSpaces(decryptedSpaces)
            }
        } catch (error) {
            console.error("Failed to fetch spaces", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const fetchSpaceItems = async (spaceId: string) => {
        if (spaceId === "spaced-fixed") {
            try {
                const response = await apiClient.getStarredItems()
                if (response.success && response.data) {
                    const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null
                    const itemsWithNames = await Promise.all(response.data.map(async (item) => {
                        let name = "Encrypted Item"
                        try {
                            if (masterKey) {
                                if (item.file_id) {
                                    name = await decryptFilename(item.encrypted_filename!, item.filename_salt!, masterKey)
                                } else if (item.folder_id) {
                                    name = await decryptFilename(item.encrypted_name!, item.name_salt!, masterKey)
                                }
                            }
                        } catch (err) {
                            console.error("Failed to decrypt item name", err)
                        }
                        return { ...item, decryptedName: name }
                    }))
                    setSpacedSpace(prev => ({ ...prev, items: itemsWithNames }))
                }
            } catch (error) {
                console.error("Failed to fetch starred items", error)
            }
            return
        }

        try {
            const response = await apiClient.getSpaceItems(spaceId)
            if (response.success && response.data) {
                const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null

                const itemsWithNames = await Promise.all(response.data.map(async (item) => {
                    let name = "Encrypted Item"
                    try {
                        if (masterKey) {
                            if (item.file_id) {
                                name = await decryptFilename(item.encrypted_filename!, item.filename_salt!, masterKey)
                            } else if (item.folder_id) {
                                name = await decryptFilename(item.encrypted_name!, item.name_salt!, masterKey)
                            }
                        }
                    } catch (err) {
                        console.error("Failed to decrypt item name", err)
                    }
                    return { ...item, decryptedName: name }
                }))

                setSpaces(prev => prev.map(s => s.id === spaceId ? { ...s, items: itemsWithNames } : s))
            }
        } catch (error) {
            console.error("Failed to fetch space items", error)
        }
    }

    useEffect(() => {
        fetchSpaces()
    }, [fetchSpaces])

    const handleDeleteSpace = async () => {
        if (!selectedSpace) return
        try {
            const response = await apiClient.deleteSpace(selectedSpace.id)
            if (response.success) {
                toast.success("Space deleted")
                fetchSpaces()
                setIsDeleteOpen(false)
            } else {
                toast.error(response.error || "Failed to delete space")
            }
        } catch (error) {
            toast.error("An error occurred")
        }
    }

    const handleRemoveItem = async (spaceId: string, itemId: string) => {
        if (spaceId === "spaced-fixed") {
            const item = spacedSpace.items?.find(i => i.id === itemId)
            if (!item) return;
            try {
                const response = await apiClient.setItemStarred({
                    fileId: item.file_id,
                    folderId: item.folder_id,
                    isStarred: false
                })
                if (response.success) {
                    toast.success("Removed from Spaced")
                    fetchSpaceItems("spaced-fixed")
                }
            } catch (e) { toast.error("Fail") }
            return
        }

        try {
            const response = await apiClient.removeItemFromSpace(spaceId, itemId)
            if (response.success) {
                toast.success("Item removed from space")
                fetchSpaceItems(spaceId)
            } else {
                toast.error(response.error || "Failed to remove item")
            }
        } catch (error) {
            toast.error("An error occurred")
        }
    }

    const handleMoveItem = async (currentSpaceId: string, itemId: string, targetSpaceId: string) => {
        // Find item to get IDs
        let itemToMove;
        if (currentSpaceId === "spaced-fixed") {
            itemToMove = spacedSpace.items?.find(i => i.id === itemId);
        } else {
            itemToMove = spaces.find(s => s.id === currentSpaceId)?.items?.find(i => i.id === itemId);
        }

        if (!itemToMove) return;

        try {
            if (targetSpaceId === "spaced-fixed") {
                const response = await apiClient.setItemStarred({
                    fileId: itemToMove.file_id,
                    folderId: itemToMove.folder_id,
                    isStarred: true
                });
                if (response.success) {
                    toast.success("Moved to Spaced")
                    fetchSpaceItems("spaced-fixed")
                    if (currentSpaceId !== "spaced-fixed") fetchSpaceItems(currentSpaceId)
                }
            } else {
                const response = await apiClient.addItemToSpace(targetSpaceId, {
                    fileId: itemToMove.file_id,
                    folderId: itemToMove.folder_id
                });
                if (response.success) {
                    toast.success("Item moved")
                    // Full refresh to ensure consistency
                    fetchSpaceItems(targetSpaceId)
                    fetchSpaceItems(currentSpaceId)
                }
            }
        } catch (error) {
            toast.error("An error occurred")
        }
    }

    const handleItemClick = (e: React.MouseEvent, item: SpaceItem) => {
        e.preventDefault()
        if (item.folder_id) {
            router.push(`/${item.folder_id}`)
        } else if (item.file_id) {
            const folderId = item.file_folder_id || ''
            router.push(`/${folderId}?preview=${item.file_id}`)
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = spaces.findIndex((s) => s.id === active.id);
            const newIndex = spaces.findIndex((s) => s.id === over.id);

            const newSpaces = arrayMove(spaces, oldIndex, newIndex);
            setSpaces(newSpaces);

            try {
                const response = await apiClient.reorderSpaces(newSpaces.map(s => s.id));
                if (!response.success) {
                    toast.error("Failed to save order");
                    fetchSpaces(); // Revert
                }
            } catch (error) {
                toast.error("Reorder failed");
                fetchSpaces();
            }
        }
    };

    return (
        <TooltipProvider>
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="flex items-center justify-between">
                    <span>Quick Spaces</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild id="tour-create-space">
                            <button className="hover:bg-accent p-1 rounded-sm transition-colors">
                                <IconPlus size={14} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => {
                                setEditSpace(null)
                                setIsCreateOpen(true)
                            }}>
                                <IconPlanet className="mr-2 h-4 w-4" />
                                <span>New Space</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarGroupLabel>
                <SidebarMenu>
                    {/* Spaced (Starred) Fixed Space */}
                    <SortableSpaceItem
                        space={spacedSpace}
                        isSpaced={true}
                        onFetchItems={fetchSpaceItems}
                        onAdd={(s) => {
                            setSelectedSpace(s)
                            setIsAddOpen(true)
                        }}
                        onItemClick={handleItemClick}
                        onRemoveItem={handleRemoveItem}
                        onMoveItem={handleMoveItem}
                        onNewSpace={() => {
                            setEditSpace(null)
                            setIsCreateOpen(true)
                        }}
                        spaces={spaces}
                    />

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                    >
                        <SortableContext
                            items={spaces.map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {spaces.map((space) => (
                                <SortableSpaceItem
                                    key={space.id}
                                    space={space}
                                    onFetchItems={fetchSpaceItems}
                                    onEdit={(s) => {
                                        setEditSpace(s)
                                        setIsCreateOpen(true)
                                    }}
                                    onDelete={(s) => {
                                        setSelectedSpace(s)
                                        setIsDeleteOpen(true)
                                    }}
                                    onAdd={(s) => {
                                        setSelectedSpace(s)
                                        setIsAddOpen(true)
                                    }}
                                    onItemClick={handleItemClick}
                                    onRemoveItem={handleRemoveItem}
                                    onMoveItem={handleMoveItem}
                                    onNewSpace={() => {
                                        setEditSpace(null)
                                        setIsCreateOpen(true)
                                    }}
                                    spaces={spaces}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </SidebarMenu>
            </SidebarGroup>

            {/* Modals */}
            <CreateSpaceModal
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSpaceCreated={fetchSpaces}
                editSpace={editSpace}
            />

            {selectedSpace && (
                <>
                    <AddToSpaceModal
                        open={isAddOpen}
                        onOpenChange={setIsAddOpen}
                        spaceId={selectedSpace.id}
                        spaceName={selectedSpace.name}
                        onItemAdded={() => {
                            fetchSpaceItems(selectedSpace.id)
                            fetchSpaces()
                            fetchSpaceItems("spaced-fixed")
                        }}
                    />

                    <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Are you sure?</DialogTitle>
                                <DialogDescription>
                                    This will permanently delete the space "{selectedSpace.name}". This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDeleteSpace}>
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </TooltipProvider>
    )
}
