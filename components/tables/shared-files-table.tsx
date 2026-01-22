"use client"

import { useState, useEffect, useCallback } from "react"

import {
    IconLoader2,
    IconDots,
    IconDownload,
    IconCopy,
    IconInfoCircle,
    IconTrash,
    IconFile,
    IconFolder,
    IconCheck,
    IconX
} from "@tabler/icons-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { apiClient, SharedItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SharedFilesTableProps {
    status?: string // Optional filter
}

export function SharedFilesTable({ status }: SharedFilesTableProps) {

    const [items, setItems] = useState<SharedItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState<string | null>(null) // ID of item being processed

    // Alert Dialog State
    const [alertOpen, setAlertOpen] = useState(false)
    const [alertConfig, setAlertConfig] = useState<{
        title: string;
        description: string;
        actionLabel: string;
        actionVariant?: "default" | "destructive";
        onConfirm: () => Promise<void>;
    } | null>(null)

    const fetchItems = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await apiClient.getSharedWithMe(status)
            if (response.success && response.data) {

                const mapped = response.data.map(item => ({
                    ...item,
                    item: {
                        ...item.item,
                        name: item.item.name || "Shared Item"
                    }
                }))
                setItems(mapped)
            }
        } catch (err) {
            console.error("Failed to fetch shared items", err)
            toast.error("Failed to load shared items")
        } finally {
            setIsLoading(false)
        }
    }, [status])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    const handleAccept = async (id: string) => {
        setIsProcessing(id)
        try {
            const res = await apiClient.acceptSharedItem(id)
            if (res.success) {
                toast.success("Share accepted")
                // Update local state
                setItems(prev => prev.map(item =>
                    item.id === id ? { ...item, status: 'accepted' } : item
                ))
            } else {
                toast.error(res.error || "Failed to accept share")
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setIsProcessing(null)
        }
    }

    const confirmDecline = (id: string) => {
        setAlertConfig({
            title: "Decline Share",
            description: "Are you sure you want to decline this share? It will be removed from your list.",
            actionLabel: "Decline",
            actionVariant: "destructive",
            onConfirm: async () => {
                try {
                    const res = await apiClient.declineSharedItem(id)
                    if (res.success) {
                        toast.success("Share declined")
                        setItems(prev => prev.filter(item => item.id !== id))
                    } else {
                        toast.error(res.error || "Failed to decline")
                    }
                } catch (err) {
                    toast.error("An error occurred")
                }
            }
        })
        setAlertOpen(true)
    }

    const confirmRemove = (id: string) => {
        setAlertConfig({
            title: "Remove Shared Item",
            description: "Are you sure you want to remove this item? You will lose access to it.",
            actionLabel: "Remove",
            actionVariant: "destructive",
            onConfirm: async () => {
                try {
                    const res = await apiClient.removeSharedItem(id)
                    if (res.success) {
                        toast.success("Item removed")
                        setItems(prev => prev.filter(item => item.id !== id))
                    } else {
                        toast.error(res.error || "Failed to remove")
                    }
                } catch (err) {
                    toast.error("An error occurred")
                }
            }
        })
        setAlertOpen(true)
    }

    const handleDownload = async (item: SharedItem) => {
        toast.info("Download starting...")
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
                <IconLoader2 className="animate-spin mr-2" />
                Loading shared items...
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border border-dashed rounded-lg">
                <IconFolder className="size-10 mb-4 opacity-20" />
                <p>No items shared with you yet.</p>
            </div>
        )
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Shared By</TableHead>
                            <TableHead className="w-[200px]">Shared On / Actions</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((share) => (
                            <TableRow key={share.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {share.item.type === 'folder' ? (
                                            <IconFolder className="size-5 text-blue-500 fill-blue-500/20" />
                                        ) : (
                                            <IconFile className="size-5 text-muted-foreground" />
                                        )}
                                        <span className={share.status === 'pending' ? 'opacity-50' : ''}>
                                            {share.item.name}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="size-6">
                                            <AvatarImage src={share.owner.avatar} />
                                            <AvatarFallback>{share.owner.name.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col text-xs">
                                            <span>{share.owner.name}</span>
                                            <span className="text-muted-foreground scale-90 origin-left">{share.owner.email}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {share.status === 'pending' ? (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                onClick={() => handleAccept(share.id)}
                                                disabled={!!isProcessing}
                                            >
                                                {isProcessing === share.id ? <IconLoader2 className="size-3 animate-spin" /> : <IconCheck className="size-3 mr-1" />}
                                                Accept
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs hover:bg-red-50 hover:text-red-600 border-red-200"
                                                onClick={() => confirmDecline(share.id)}
                                                disabled={!!isProcessing}
                                            >
                                                <IconX className="size-3 mr-1" />
                                                Decline
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(share.createdAt), 'MMM d, yyyy')}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {share.status === 'accepted' && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <IconDots className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDownload(share)}>
                                                    <IconDownload className="size-4 mr-2" />
                                                    Download
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toast.info("Copy not implemented")}>
                                                    <IconCopy className="size-4 mr-2" />
                                                    Make a copy
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toast.info("Details not implemented")}>
                                                    <IconInfoCircle className="size-4 mr-2" />
                                                    View details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    onClick={() => confirmRemove(share.id)}
                                                >
                                                    <IconTrash className="size-4 mr-2" />
                                                    Remove
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertConfig?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertConfig?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault() // Create simple loading state if needed
                                if (alertConfig) await alertConfig.onConfirm()
                                setAlertOpen(false)
                            }}
                            className={alertConfig?.actionVariant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                        >
                            {alertConfig?.actionLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
