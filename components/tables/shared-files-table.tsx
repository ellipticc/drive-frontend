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
import dynamic from 'next/dynamic'
import { useGlobalUpload } from "@/components/global-upload-context"
import { Table, TableCard } from "@/components/application/table/table"
import { Checkbox } from "@/components/base/checkbox/checkbox"
import { TableSkeleton } from "@/components/tables/table-skeleton"
import { useLanguage } from "@/lib/i18n/language-context"
import { useIsMobile } from "@/hooks/use-mobile"
import {
    ActionBar,
    ActionBarSelection,
    ActionBarGroup,
    ActionBarItem,
    ActionBarClose,
    ActionBarSeparator,
} from "@/components/ui/action-bar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const DetailsModal = dynamic(() => import("@/components/modals/details-modal").then(mod => mod.DetailsModal));
const CopyModal = dynamic(() => import("@/components/modals/copy-modal").then(mod => mod.CopyModal));
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
    const { t } = useLanguage()
    const [items, setItems] = useState<SharedItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState<string | null>(null)
    const { formatDate } = useFormatter()
    const isMobile = useIsMobile()

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

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

    // Details & Copy modal state
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: 'file' | 'folder' | 'paper' } | null>(null)

    const [copyModalOpen, setCopyModalOpen] = useState(false)
    const [selectedItemForCopy, setSelectedItemForCopy] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null)

    const { startFileDownload, startFolderDownload, startFileDownloadWithCEK } = useGlobalUpload()

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

    // Bulk actions
    const handleAcceptBulk = async () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        setIsProcessing('bulk-accept');
        try {
            await Promise.all(ids.map(id => apiClient.acceptSharedItem(id)));
            toast.success('Accepted selected shares');
            // update local state
            setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'accepted' } : item));
            setSelectedItems(new Set());
        } catch (err) {
            toast.error('Failed to accept selected shares');
        } finally {
            setIsProcessing(null);
        }
    }

    const handleRemoveBulk = async () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        setIsProcessing('bulk-remove');
        try {
            await Promise.all(ids.map(id => apiClient.removeSharedItem(id)));
            toast.success('Removed selected shares');
            setItems(prev => prev.filter(i => !ids.includes(i.id)));
            setSelectedItems(new Set());
        } catch (err) {
            toast.error('Failed to remove selected shares');
        } finally {
            setIsProcessing(null);
        }
    }

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
        try {
            // If file: decapsulate shared secret and hand to global download manager which shows unified progress
            if (item.item.type === 'file') {
                if (!item.kyberCiphertext || !item.encryptedCek || !item.encryptedCekNonce) throw new Error('Missing encryption material')

                const userRes = await apiClient.getMe();
                let userKeys: any | undefined;
                if (userRes.success && userRes.data) {
                    try {
                        userKeys = await decryptUserPrivateKeys(userRes.data as any);
                    } catch (e) {
                        // ignore
                    }
                }

                const kyberCiphertext = hexToUint8Array(item.kyberCiphertext)
                const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, userKeys?.kyberPrivateKey)
                const cek = decryptData(item.encryptedCek, new Uint8Array(sharedSecret), item.encryptedCekNonce!)

                // Use global download pipeline that supports unified progress modal (CEK-aware variant)
                if (startFileDownloadWithCEK) {
                    await startFileDownloadWithCEK(item.item.id, decryptedNames[item.id] || item.item.name || 'file', cek)
                    toast.success('Download completed')
                } else {
                    // Fallback: call local download implementation
                    await downloadEncryptedFileWithCEK(item.item.id, cek, (progress) => {
                        toast.loading(`Downloading... ${Math.round(progress.overallProgress)}%`)
                    })
                    toast.success('Download completed')
                }

            } else if (item.item.type === 'folder') {
                // Use global folder download which shows unified progress
                if (startFolderDownload) {
                    await startFolderDownload(item.item.id, decryptedNames[item.id] || item.item.name || 'folder')
                    toast.success('Folder download completed')
                } else {
                    // Fallback
                    const userRes = await apiClient.getMe();
                    let userKeys: any | undefined;
                    if (userRes.success && userRes.data) {
                        try {
                            userKeys = await decryptUserPrivateKeys(userRes.data as any);
                        } catch (e) {
                            // ignore
                        }
                    }
                    await downloadFolderAsZip(item.item.id, decryptedNames[item.id] || item.item.name || 'folder', userKeys, () => {})
                    toast.success('Folder download completed')
                }
            } else {
                toast.error('Downloading this type is not implemented yet')
            }
        } catch (err: any) {
            console.error('Download failed', err)
            toast.error(err?.message || 'Download failed')
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

    const openDetails = (share: SharedItem) => {
        setSelectedItemForDetails({ id: share.item.id, name: decryptedNames[share.id] || share.item.name || 'item', type: share.item.type === 'folder' ? 'folder' : share.item.type === 'paper' ? 'paper' : 'file' })
        setDetailsModalOpen(true)
    }

    const columns = useMemo(() => [
        { id: "name", name: "Name", isRowHeader: true },
        { id: "sharedBy", name: "Shared By" },
        { id: "actions", name: "Status / Actions" },
    ], [])

    if (isLoading) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header title={t('sidebar.sharedWithMe')} className="h-10 border-0" />
                <TableSkeleton title={t('sidebar.sharedWithMe')} />
            </TableCard.Root>
        )
    }

    if (items.length === 0) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header title={t('sidebar.sharedWithMe')} className="h-10 border-0" />
                <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <IconFolder className="size-10 mb-4 opacity-20 mx-auto" />
                        <p className="text-sm text-muted-foreground">No items shared with you yet.</p>
                    </div>
                </div>
            </TableCard.Root>
        )
    }

    return (
        <>
            <TableCard.Root size="sm">
                <TableCard.Header
                    title={t('sidebar.sharedWithMe')}
                    contentTrailing={
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleAcceptBulk}
                                disabled={items.length === 0 && selectedItems.size === 0}
                                className={`h-8 w-8 p-0 ${selectedItems.size > 0 ? 'bg-primary/10 text-primary' : ''}`}
                                aria-label={selectedItems.size > 0 ? `Accept ${selectedItems.size} Selected` : "Accept All"}
                            >
                                <IconCheck className="size-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleRemoveBulk}
                                disabled={items.length === 0 && selectedItems.size === 0}
                                className="h-8 w-8 p-0"
                            >
                                <IconTrash className="size-4" />
                            </Button>
                        </div>
                    }
                />

                <Table
                    selectionBehavior="replace"
                    selectedKeys={selectedItems}
                    onSelectionChange={(keys) => {
                        if (keys === 'all') {
                            if (selectedItems.size > 0 && selectedItems.size < items.length) {
                                setSelectedItems(new Set());
                            } else {
                                setSelectedItems(new Set(items.map(item => item.id)));
                            }
                        } else {
                            setSelectedItems(new Set(Array.from(keys as Set<string>)));
                        }
                    }}
                >
                    <Table.Header className="group sticky top-0 z-40 bg-background border-b">
                        <Table.Head className="w-10 text-center pl-4 pr-0">
                            <Checkbox
                                slot="selection"
                                className={`transition-opacity duration-200 ${selectedItems.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                            />
                        </Table.Head>
                        <Table.Head id="name" isRowHeader className="w-full max-w-0 pointer-events-none cursor-default" align="left">
                            {selectedItems.size > 0 ? (
                                <span className="text-xs font-semibold whitespace-nowrap text-foreground px-1.5 py-1">{selectedItems.size} selected</span>
                            ) : (
                                <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">Name</span>
                            )}
                        </Table.Head>
                        {!isMobile && (
                            <Table.Head id="sharedBy" className="pointer-events-none cursor-default w-[200px]">
                                <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">Shared By</span>
                            </Table.Head>
                        )}
                        {!isMobile && (
                            <Table.Head id="date" className="pointer-events-none cursor-default min-w-[120px]" align="right">
                                <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">Shared at</span>
                            </Table.Head>
                        )}
                        <Table.Head id="actions" align="center" />
                    </Table.Header>

                    <Table.Body items={items}>
                        {(item: SharedItem) => (
                            <Table.Row key={item.id} className="group hover:bg-muted/50 transition-colors duration-150" onDoubleClick={() => openDetails(item)}>
                                <Table.Cell className="w-10 text-center pl-4 pr-0">
                                    <Checkbox
                                        slot="selection"
                                        className={`transition-opacity duration-200 ${selectedItems.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                    />
                                </Table.Cell>

                                <Table.Cell className="w-full max-w-0">
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

                                <Table.Cell className="min-w-[120px] text-right">
                                    <span className="text-xs text-muted-foreground">{formatDate(new Date(item.createdAt))}</span>
                                </Table.Cell>

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
                                                    <DropdownMenuItem onSelect={() => { setSelectedItemForCopy({ id: item.item.id, name: decryptedNames[item.id] || item.item.name || 'item', type: item.item.type === 'folder' ? 'folder' : 'file' }); setCopyModalOpen(true); }}>
                                                        <IconCopy className="size-4 mr-2" /> Copy
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => { setSelectedItemForDetails({ id: item.item.id, name: decryptedNames[item.id] || item.item.name || 'item', type: item.item.type === 'folder' ? 'folder' : item.item.type === 'paper' ? 'paper' : 'file' }); setDetailsModalOpen(true); }}>
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
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </TableCard.Root>

            <ActionBar open={selectedItems.size > 0}>
                <ActionBarSelection>
                    {selectedItems.size} selected
                </ActionBarSelection>
                <ActionBarSeparator />
                <ActionBarGroup>
                    <ActionBarItem onClick={handleAcceptBulk}>
                        <IconCheck className="h-4 w-4 mr-2" /> Accept
                    </ActionBarItem>
                    <ActionBarItem variant="destructive" onClick={handleRemoveBulk}>
                        <IconTrash className="h-4 w-4 mr-2" /> Remove
                    </ActionBarItem>
                </ActionBarGroup>
                <ActionBarSeparator />
                <ActionBarClose onClick={() => setSelectedItems(new Set())}>
                    <IconX className="h-4 w-4" />
                </ActionBarClose>
            </ActionBar>

            <DetailsModal
                itemId={selectedItemForDetails?.id || ""}
                itemName={selectedItemForDetails?.name || ""}
                itemType={selectedItemForDetails?.type || "file"}
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
            />

            <CopyModal
                itemId={selectedItemForCopy?.id || ""}
                itemName={selectedItemForCopy?.name || ""}
                itemType={selectedItemForCopy?.type || "file"}
                open={copyModalOpen}
                onOpenChange={setCopyModalOpen}
            />

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
