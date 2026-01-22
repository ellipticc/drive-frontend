"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
    IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useFormatter } from "@/hooks/use-formatter"

import { apiClient, SharedItem } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { ml_kem768, decryptData, hexToUint8Array, decryptUserPrivateKeys } from "@/lib/crypto"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Table,
} from "@/components/application/table/table"
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
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { downloadEncryptedFileWithCEK, downloadFolderAsZip, downloadMultipleItemsAsZip } from "@/lib/download"

interface SharedFilesTableProps {
    status?: string // Optional filter
}

export function SharedFilesTable({ status }: SharedFilesTableProps) {
    const [items, setItems] = useState<SharedItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState<string | null>(null)
    const { formatDate } = useFormatter()

    // Alert Dialog State
    const [alertOpen, setAlertOpen] = useState(false)
    const [alertConfig, setAlertConfig] = useState<{
        title: string;
        description: string;
        actionLabel: string;
        actionVariant?: "default" | "destructive";
        onConfirm: () => Promise<void>;
    } | null>(null)

    // Decrypted names cache
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({})

    // Details dialog state
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsItem, setDetailsItem] = useState<SharedItem | null>(null)
    const [detailsData, setDetailsData] = useState<any>(null)
    const [detailsLoading, setDetailsLoading] = useState(false)

    const fetchItems = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await apiClient.getSharedWithMe(status)
            if (response.success && response.data) {
                setItems(response.data)

                // Fetch user data to get private keys
                const userRes = await apiClient.getMe();
                let kyberPrivateKey: Uint8Array | undefined;

                if (userRes.success && userRes.data) {
                    try {
                        const keys = await decryptUserPrivateKeys(userRes.data as any);
                        kyberPrivateKey = keys.kyberPrivateKey;
                    } catch (e) {
                        // Fallback or ignore if keys unavailable (e.g. not fully setup)
                    }
                }

                let newDecrypted: Record<string, string> = {};
                if (kyberPrivateKey) {
                    newDecrypted = {};
                    await Promise.all(response.data.map(async (item) => {
                        if (!item.kyberCiphertext || !item.encryptedCek || !item.encryptedCekNonce) {
                            return;
                        }

                        try {
                            const kyberCiphertext = hexToUint8Array(item.kyberCiphertext);
                            const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, kyberPrivateKey!);

                            const cek = decryptData(item.encryptedCek, new Uint8Array(sharedSecret), item.encryptedCekNonce!);

                            if (item.item.encryptedName && item.item.nameSalt) {
                                try {
                                    const nameBytes = decryptData(item.item.encryptedName, cek, item.item.nameSalt);
                                    // Convert bytes to string
                                    const name = new TextDecoder().decode(nameBytes);
                                    if (name && /^[ -~]+$/.test(name)) { // Simple check for printable ASCII or valid unicode
                                        newDecrypted[item.id] = name;
                                    } else {
                                        newDecrypted[item.id] = "Shared Item (Locked)";
                                    }
                                } catch {
                                    newDecrypted[item.id] = "Shared Item (Locked)";
                                }
                            }
                        } catch (e) {
                            console.error("Decryption failed for item " + item.id, e);
                            newDecrypted[item.id] = "Decryption Failed";
                        }
                    }));
                }
                setDecryptedNames(prev => ({ ...prev, ...newDecrypted }));
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
        setIsProcessing(item.id)
        const toastId = toast.loading('Starting download...')
        try {
            // Get user keys
            const userRes = await apiClient.getMe();
            let userKeys: any | undefined;
            if (userRes.success && userRes.data) {
                try {
                    userKeys = await decryptUserPrivateKeys(userRes.data as any);
                } catch (e) {
                    // ignore
                }
            }

            // If file
            if (item.item.type === 'file') {
                if (!item.kyberCiphertext || !item.encryptedCek || !item.encryptedCekNonce) throw new Error('Missing encryption material')

                const kyberCiphertext = hexToUint8Array(item.kyberCiphertext)
                const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys?.kyberPrivateKey)
                const cek = decryptData(item.encryptedCek, new Uint8Array(sharedSecret), item.encryptedCekNonce!)

                await downloadEncryptedFileWithCEK(item.item.id, cek, (progress) => {
                    // Update with progress if you want; keep it simple here
                    toast.loading(`Downloading... ${Math.round(progress.overallProgress)}%`, { id: toastId })
                })
                toast.success('Download completed', { id: toastId })
            } else if (item.item.type === 'folder') {
                // Folder download as ZIP
                await downloadFolderAsZip(item.item.id, decryptedNames[item.id] || item.item.name || 'folder', userKeys, (progress) => {
                    toast.loading(`Downloading... ${Math.round(progress.overallProgress)}%`, { id: toastId })
                })
                toast.success('Folder download completed', { id: toastId })
            } else {
                toast.error('Downloading this type is not implemented yet', { id: toastId })
            }
        } catch (err: any) {
            console.error('Download failed', err)
            toast.error(err?.message || 'Download failed', { id: toastId })
        } finally {
            setIsProcessing(null)
        }
    }

    const handleCopyLink = async (share: SharedItem) => {
        try {
            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/s?shareId=${share.id}`
            await navigator.clipboard.writeText(url)
            toast.success('Share link copied to clipboard')
        } catch (err) {
            toast.error('Failed to copy link')
        }
    }

    const openDetails = async (share: SharedItem) => {
        setDetailsItem(share)
        setDetailsOpen(true)
        setDetailsLoading(true)
        try {
            const res = await apiClient.getShare(share.id)
            if (res.success && res.data) {
                // Try to decrypt name if possible
                let decryptedName = undefined
                try {
                    if (share.kyberCiphertext && share.encryptedCek && share.encryptedCekNonce && res.data.encrypted_filename && res.data.nonce_filename) {
                        const userRes = await apiClient.getMe();
                        const keys = await decryptUserPrivateKeys(userRes.data as any)
                        const kyberCiphertext = hexToUint8Array(share.kyberCiphertext)
                        const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, keys.kyberPrivateKey)
                        const cek = decryptData(share.encryptedCek!, new Uint8Array(sharedSecret), share.encryptedCekNonce!)
                        const nameBytes = decryptData(res.data.encrypted_filename, cek, res.data.nonce_filename)
                        decryptedName = new TextDecoder().decode(nameBytes)
                    }
                } catch (e) {
                    // ignore
                }

                setDetailsData({ ...res.data, decryptedName })
            } else {
                toast.error('Failed to load share details')
            }
        } catch (err) {
            console.error(err)
            toast.error('Failed to load share details')
        } finally {
            setDetailsLoading(false)
        }
    }

    const columns = useMemo(() => [
        { id: "name", name: "Name", isRowHeader: true },
        { id: "sharedBy", name: "Shared By" },
        { id: "actions", name: "Status / Actions" },
    ], [])

    if (isLoading) {
        return (
            <div className="w-full h-full">
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <IconLoader2 className="animate-spin mr-2" />
                    Loading shared items...
                </div>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border border-dashed rounded-lg h-[400px]">
                <IconFolder className="size-10 mb-4 opacity-20" />
                <p>No items shared with you yet.</p>
            </div>
        )
    }

    return (
        <>
            <div className="h-full w-full">
                <Table className="w-full" size="md">
                    <Table.Header columns={columns}>
                        {(column) => (
                            <Table.Head key={column.id} label={column.name} />
                        )}
                    </Table.Header>

                    <Table.Body items={items}>
                        {(item: SharedItem) => (
                            <Table.Row key={item.id} columns={columns}>
                                {(column: any) => {
                                    switch (column.id) {
                                        case 'name':
                                            return (
                                                <Table.Cell>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="shrink-0 text-muted-foreground">
                                                            {item.item.type === 'folder' ? (
                                                                <IconFolder className="size-5 text-blue-500 fill-blue-500/20" />
                                                            ) : (
                                                                <IconFile className="size-5" />
                                                            )}
                                                        </div>
                                                        <div className="truncate font-medium">
                                                            <button className="text-left w-full truncate" onClick={() => openDetails(item)}>
                                                                {decryptedNames[item.id] || item.item.name || "Shared Item"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Table.Cell>
                                            )

                                        case 'sharedBy':
                                            return (
                                                <Table.Cell>
                                                    <div className="hidden md:flex items-center gap-2">
                                                        <Avatar className="size-6">
                                                            <AvatarImage src={item.owner.avatar} />
                                                            <AvatarFallback>{item.owner.name.substring(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col text-xs truncate">
                                                            <span className="font-medium truncate">{item.owner.name}</span>
                                                            <span className="text-muted-foreground text-[10px] truncate">{item.owner.email}</span>
                                                        </div>
                                                    </div>
                                                </Table.Cell>
                                            )

                                        case 'actions':
                                            return (
                                                <Table.Cell>
                                                    <div className="flex items-center justify-end gap-2">
                                                        {item.status === 'pending' ? (
                                                            <div className="flex items-center gap-2">
                                                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleAccept(item.id)}>
                                                                    <IconCheck className="size-3 mr-1" /> Accept
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => confirmDecline(item.id)}>
                                                                    <IconX className="size-3" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                        <IconDots className="size-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => handleDownload(item)}>
                                                                        <IconDownload className="size-4 mr-2" /> Download
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleCopyLink(item)}>
                                                                        <IconCopy className="size-4 mr-2" /> Copy Link
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openDetails(item)}>
                                                                        <IconInfoCircle className="size-4 mr-2" /> Details
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmRemove(item.id)}>
                                                                        <IconTrash className="size-4 mr-2" /> Remove
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </Table.Cell>
                                            )

                                        default:
                                            return <Table.Cell />
                                    }
                                }}</Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </div>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Share details</DialogTitle>
                        <DialogDescription>
                            {detailsLoading ? 'Loading...' : detailsData?.decryptedName || detailsData?.encrypted_filename || ''}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4">
                        <p className="text-sm text-muted-foreground">Shared by: {detailsData?.sharedBy?.name || detailsItem?.owner.name}</p>
                        <p className="text-sm text-muted-foreground">Type: {detailsItem?.item.type}</p>
                        <p className="text-sm text-muted-foreground">Status: {detailsItem?.status}</p>
                        <p className="text-sm text-muted-foreground">Shared at: {detailsItem ? formatDate(new Date(detailsItem.createdAt)) : ''}</p>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => detailsItem && handleDownload(detailsItem)}>Download</Button>
                        <Button variant="ghost" onClick={() => detailsItem && handleCopyLink(detailsItem)}>Copy link</Button>
                        <DialogClose asChild>
                            <Button>Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                e.preventDefault()
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
