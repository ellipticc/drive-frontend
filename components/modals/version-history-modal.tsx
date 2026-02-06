"use client"

import React, { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { IconHistory, IconRestore, IconTrash, IconLoader2, IconEye, IconX, IconCopyPlus, IconGitBranch, IconPencil, IconGitCompare } from "@tabler/icons-react"
import { format } from "date-fns"
import { useFormatter } from "@/hooks/use-formatter"
import { getDiceBearAvatar } from "@/lib/avatar"
import { PaperPreview } from "@/components/previews/paper-preview"
import { DiffBlockViewer } from "@/components/modals/diff-block-viewer"
import { masterKeyManager } from "@/lib/master-key"
import { paperService } from "@/lib/paper-service"
import { decryptFilename, encryptFilename } from "@/lib/crypto"
import { Input } from "@/components/ui/input"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
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
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface Version {
    id: string
    versionIndex: number
    createdAt: string
    totalSize: number
    expiresAt: string | null
    isManual: boolean
    triggerType: string
    customName?: string
    customNameSalt?: string
    decryptedName?: string // Decrypted on client
    insertions?: number
    deletions?: number
    createdBy?: {
        name: string
        email: string
        avatar: string
    }
}

interface VersionHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    fileId: string
    onRestoreComplete: () => void
    selectedVersionId?: string | null
    onVersionSelect?: (versionId: string | null) => void
}

export function VersionHistoryModal({
    isOpen,
    onClose,
    fileId,
    onRestoreComplete,
    selectedVersionId,
    onVersionSelect
}: VersionHistoryModalProps) {
    const { formatDateTime, formatDateOnly, formatTimeOnly } = useFormatter()
    const [versions, setVersions] = useState<Version[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [copyingId, setCopyingId] = useState<string | null>(null)
    const [restoringId, setRestoringId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [snapshotting, setSnapshotting] = useState(false)
    const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)
    const [previewContent, setPreviewContent] = useState<any>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [showDiff, setShowDiff] = useState(false)
    const [previousContent, setPreviousContent] = useState<any>(null)
    const [diffLoading, setDiffLoading] = useState(false)

    // Rename dialog
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [renamingVersionId, setRenamingVersionId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renaming, setRenaming] = useState(false)

    // Confirmation states
    const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const fetchVersions = async () => {
        setLoading(true)
        // Small delay to ensure skeleton renders
        await new Promise(resolve => setTimeout(resolve, 50))
        try {
            const res = await apiClient.getPaperVersions(fileId)
            if (res.success && res.data) {
                // Decrypt custom names
                const masterKey = await masterKeyManager.getMasterKey()
                const decryptedVersions = await Promise.all(
                    res.data.versions.map(async (v: any) => {
                        if (v.customName && v.customNameSalt && masterKey) {
                            try {
                                const decryptedName = await decryptFilename(v.customName, v.customNameSalt, masterKey)
                                return { ...v, decryptedName }
                            } catch (e) {
                                console.error('Failed to decrypt version name:', e)
                                return v
                            }
                        }
                        return v
                    })
                )
                setVersions(decryptedVersions)
            } else {
                toast.error("Failed to load version history")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to load version history")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchVersions()
        }
    }, [isOpen, fileId])

    const handleSaveVersion = async () => {
        setSaving(true)
        try {
            const res = await apiClient.savePaperVersion(fileId)
            if (res.success) {
                if (res.data?.skipped) {
                    toast.info("No changes to save (Duplicate version)")
                } else {
                    toast.success("Current version saved successfully")
                    fetchVersions() // Refresh list
                }
            } else {
                toast.error(res.error || "Failed to save version")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to save version")
        } finally {
            setSaving(false)
        }
    }

    const handleRestore = async (versionId: string) => {
        setRestoringId(versionId)
        try {
            const res = await apiClient.restorePaperVersion(fileId, versionId)
            if (res.success) {
                toast.success("Paper restored successfully")
                onRestoreComplete() // Trigger parent reload
                onClose()
            } else {
                toast.error(res.error || "Failed to restore version")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to restore version")
        } finally {
            setRestoringId(null)
            setConfirmRestoreId(null)
        }
    }

    const handleDelete = async (versionId: string) => {
        setDeletingId(versionId)
        try {
            const res = await apiClient.deletePaperVersion(fileId, versionId)
            if (res.success) {
                toast.success("Version deleted")
                setVersions(prev => prev.filter(v => v.id !== versionId))
            } else {
                toast.error(res.error || "Failed to delete version")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete version")
        } finally {
            setDeletingId(null)
            setConfirmDeleteId(null)
        }
    }

    const handleMakeCopy = async (versionId: string) => {
        setCopyingId(versionId)
        try {
            const now = new Date()
            const dateStr = format(now, 'yyyy-MM-dd HH.mm.ss')
            const copySuffix = ` (copy ${dateStr})`

            // Get the current paper metadata to get the original title
            const paperRes = await apiClient.getPaper(fileId)
            if (!paperRes.success || !paperRes.data) {
                toast.error("Failed to get paper metadata")
                return
            }

            const originalEncryptedTitle = paperRes.data.encryptedTitle
            const originalTitleSalt = paperRes.data.titleSalt

            // Get master key to decrypt and re-encrypt with the copy suffix
            const masterKey = await masterKeyManager.getMasterKey()
            if (!masterKey) {
                toast.error("Master key not available")
                return
            }

            // Decrypt the original title using XChaCha20-Poly1305
            const decryptedTitle = await decryptFilename(originalEncryptedTitle, originalTitleSalt, masterKey)

            // Add copy suffix
            const newTitle = decryptedTitle + copySuffix

            // Re-encrypt with a new salt using XChaCha20-Poly1305
            const { encryptedFilename: newEncryptedTitle, filenameSalt: newSalt } = await encryptFilename(newTitle, masterKey)

            // Call the API with encrypted title
            const res = await apiClient.copyPaperVersion(fileId, versionId, newEncryptedTitle, newSalt)
            if (res.success && res.data) {
                toast.success("Copy created successfully")
                // Open the new paper in a new tab
                window.open(`/paper?fileId=${res.data.newFileId}`, '_blank')
                onClose()
            } else {
                toast.error(res.error || "Failed to create copy")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to create copy")
        } finally {
            setCopyingId(null)
        }
    }

    const handleCreateSnapshot = async () => {
        setSnapshotting(true)
        try {
            const res = await apiClient.createManualSnapshot(fileId)
            if (res.success) {
                if (res.data?.skipped) {
                    toast.info("Snapshot throttled")
                } else {
                    toast.success("Manual snapshot created")
                    fetchVersions() // Refresh list
                }
            } else {
                toast.error(res.error || "Failed to create snapshot")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to create snapshot")
        } finally {
            setSnapshotting(false)
        }
    }

    const handleRenameVersion = async () => {
        if (!renamingVersionId || !renameValue.trim()) return

        if (renameValue.length > 100) {
            toast.error("Version name must be 100 characters or less")
            return
        }

        setRenaming(true)
        try {
            const masterKey = await masterKeyManager.getMasterKey()
            if (!masterKey) {
                toast.error("Master key not available")
                return
            }

            // Encrypt the name client-side
            const { encryptedFilename: encryptedName, filenameSalt: nameSalt } = await encryptFilename(renameValue, masterKey)

            const res = await apiClient.renamePaperVersion(fileId, renamingVersionId, encryptedName, nameSalt)
            if (res.success) {
                toast.success("Version renamed")
                fetchVersions() // Refresh list
                setRenameDialogOpen(false)
                setRenameValue('')
                setRenamingVersionId(null)
            } else {
                toast.error(res.error || "Failed to rename version")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to rename version")
        } finally {
            setRenaming(false)
        }
    }

    const openRenameDialog = (versionId: string) => {
        setRenamingVersionId(versionId)
        setRenameValue('')
        setRenameDialogOpen(true)
    }

    // Auto-select version on load or when selectedVersionId changes
    useEffect(() => {
        if (versions.length > 0) {
            if (selectedVersionId) {
                const version = versions.find(v => v.id === selectedVersionId);
                if (version && version.id !== previewVersionId) {
                    handlePreview(version);
                }
            } else if (!previewVersionId) {
                handlePreview(versions[0]);
            }
        }
    }, [versions, previewVersionId, selectedVersionId]);

    const handlePreview = async (version: Version) => {
        // Don't reload if already viewing this version
        if (previewVersionId === version.id) {
            return
        }

        setPreviewVersionId(version.id)
        onVersionSelect?.(version.id)
        setPreviewLoading(true)
        setPreviewContent(null)
        setPreviousContent(null)

        try {
            // Load current version
            const paperData = await paperService.getPaperVersion(fileId, version.id)
            setPreviewContent(paperData.content)

            // Load previous version for diff (if not the oldest version)
            const versionIndex = versions.findIndex(v => v.id === version.id)
            if (versionIndex < versions.length - 1) {
                try {
                    const previousVersion = versions[versionIndex + 1]
                    const previousData = await paperService.getPaperVersion(fileId, previousVersion.id)
                    setPreviousContent(previousData.content)
                } catch (err) {
                    console.warn('Failed to load previous version for diff:', err)
                }
            } else {
                // Oldest version: compare against empty content
                setPreviousContent([])
            }
        } catch (e) {
            console.error(e)
            toast.error("Failed to load preview")
            setPreviewContent(null)
        } finally {
            setPreviewLoading(false)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <>
            {/* Full-screen overlay portal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
                    {/* Modal container */}
                    <div className="w-[98vw] h-[96vh] flex flex-row gap-0 overflow-hidden bg-background border shadow-2xl rounded-xl">

                        {/* LEFT: Preview Area */}
                        <div className="flex-1 bg-muted/30 flex flex-col relative h-full">
                            {/* Header Overlay */}
                            <div className="flex items-center justify-between px-6 py-3 bg-background border-b shrink-0 z-10 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 max-w-md">
                                        <IconHistory className="w-5 h-5 text-primary" />
                                        <span className="font-semibold text-sm truncate">
                                            {previewVersionId ?
                                                (versions.find(v => v.id === previewVersionId)?.isManual
                                                    ? "Manual Save"
                                                    : `Version #${versions.find(v => v.id === previewVersionId)?.versionIndex}`)
                                                : "Selecting..."}
                                        </span>
                                    </div>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-muted/60 text-muted-foreground flex items-center gap-1.5 cursor-help">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                    End-to-end encrypted
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="max-w-xs">
                                                <p className="text-xs">Your document is encrypted on your device before being sent to our servers. Only you can decrypt and read it.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Diff Toggle */}
                                    {previewVersionId && previousContent && (
                                        <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowDiff(false)}
                                                className={`rounded-none h-7 px-3 text-xs ${!showDiff ? 'bg-muted' : ''}`}
                                            >
                                                <IconEye className="w-3.5 h-3.5 mr-1.5" />
                                                Preview
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowDiff(true)}
                                                className={`rounded-none h-7 px-3 text-xs ${showDiff ? 'bg-muted' : ''}`}
                                            >
                                                <IconGitCompare className="w-3.5 h-3.5 mr-1.5" />
                                                Diff
                                            </Button>
                                        </div>
                                    )}
                                    {previewVersionId && (
                                        <>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium pr-3 border-r">
                                                <span>{formatDateTime(versions.find(v => v.id === previewVersionId)?.createdAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded bg-muted/40 font-semibold">
                                                <IconEye className="w-3.5 h-3.5" />
                                                View only
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Preview Content */}
                            <div className="flex-1 overflow-auto relative w-full h-full flex items-start justify-center p-6 md:p-10">
                                {previewLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                ) : showDiff && previousContent && previewContent ? (
                                    <div className="w-full max-w-6xl">
                                        <DiffBlockViewer
                                            oldContent={previousContent}
                                            newContent={previewContent}
                                        />
                                    </div>
                                ) : previewContent ? (
                                    <div className="bg-background shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] rounded-lg border w-full max-w-4xl min-h-full overflow-auto relative">
                                        <PaperPreview fileId={fileId} initialContent={previewContent} />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <p className="text-sm">Select a version to preview</p>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* RIGHT: Sidebar */}
                        <div className="w-[320px] flex flex-col border-l h-full bg-background z-20 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)] overflow-hidden">
                            {/* Sticky Header */}
                            <div className="px-6 py-4 shrink-0 flex flex-row items-center justify-between space-y-0 bg-background border-b sticky top-0 z-10">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                    Document History
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-8 w-8 rounded-full hover:bg-muted"
                                >
                                    <IconX className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="flex flex-col pb-10">
                                    {loading ? (
                                        <div className="space-y-3">
                                            {/* Skeleton for Today */}
                                            <div>
                                                <div className="px-4 py-1.5">
                                                    <Skeleton className="h-3 w-12" />
                                                </div>
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div key={i} className="px-4 py-2.5 flex flex-col gap-0.5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                <Skeleton className="h-3 w-16" />
                                                            </div>
                                                            <Skeleton className="h-4 w-12 rounded" />
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px]">
                                                            <Skeleton className="h-4 w-4 rounded-full" />
                                                            <Skeleton className="h-3 w-20" />
                                                            <Skeleton className="h-3 w-8" />
                                                            <Skeleton className="h-3 w-12" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Skeleton for Yesterday */}
                                            <div>
                                                <div className="px-4 py-1.5">
                                                    <Skeleton className="h-3 w-16" />
                                                </div>
                                                {Array.from({ length: 2 }).map((_, i) => (
                                                    <div key={i} className="px-4 py-2.5 flex flex-col gap-0.5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                <Skeleton className="h-3 w-16" />
                                                            </div>
                                                            <Skeleton className="h-4 w-12 rounded" />
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px]">
                                                            <Skeleton className="h-4 w-4 rounded-full" />
                                                            <Skeleton className="h-3 w-20" />
                                                            <Skeleton className="h-3 w-8" />
                                                            <Skeleton className="h-3 w-12" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : versions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-center px-8">
                                            <IconHistory className="w-10 h-10 opacity-10" />
                                            <p className="text-sm font-medium">No snapshots yet</p>
                                            <p className="text-xs opacity-60">Version snapshots will appear here as you work.</p>
                                        </div>
                                    ) : (
                                        /* Group by Date */
                                        <div className="space-y-3">
                                            {Object.entries(
                                                versions.reduce((acc, v) => {
                                                    const date = new Date(v.createdAt);
                                                    const group = formatDateOnly(date) === formatDateOnly(new Date())
                                                        ? 'Today'
                                                        : formatDateOnly(date) === formatDateOnly(new Date(Date.now() - 86400000))
                                                            ? 'Yesterday'
                                                            : formatDateOnly(date);
                                                    if (!acc[group]) acc[group] = [];
                                                    acc[group].push(v);
                                                    return acc;
                                                }, {} as Record<string, Version[]>)
                                            ).map(([group, groupVersions]) => (
                                                <div key={group}>
                                                    <div className="px-4 py-1.5">
                                                        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                                            {group}
                                                        </h3>
                                                    </div>

                                                    {groupVersions.map((version) => {
                                                        const idx = versions.findIndex(v => v.id === version.id);
                                                        return (
                                                            <button
                                                                key={version.id}
                                                                onClick={() => handlePreview(version)}
                                                                className={`w-full text-left px-4 py-2.5 transition-all hover:bg-muted/50 flex flex-col gap-0.5 relative group ${previewVersionId === version.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between pointer-events-none">
                                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                        <span className={`text-xs font-medium ${previewVersionId === version.id ? "text-primary" : "text-foreground"}`}>
                                                                            {formatTimeOnly(version.createdAt)}
                                                                        </span>
                                                                        {version.decryptedName && (
                                                                            <>
                                                                                <span className="text-xs text-muted-foreground">·</span>
                                                                                <span className="text-xs text-muted-foreground truncate" title={version.decryptedName}>
                                                                                    {version.decryptedName}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>

                                                                    {idx === 0 && (
                                                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-tight">
                                                                            Current
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pointer-events-none">
                                                                    {/* User Avatar and Name */}
                                                                    {version.createdBy && (
                                                                        <TooltipProvider delayDuration={100}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <div className="flex items-center gap-1.5 pointer-events-auto cursor-help">
                                                                                        <Avatar className="w-4 h-4">
                                                                                            <AvatarImage
                                                                                                src={version.createdBy.avatar || getDiceBearAvatar(version.createdBy.email || 'user', 16)}
                                                                                                alt={version.createdBy.name || version.createdBy.email}
                                                                                            />
                                                                                            <AvatarFallback className="text-[8px]">
                                                                                                {(version.createdBy.name || version.createdBy.email || 'U').charAt(0).toUpperCase()}
                                                                                            </AvatarFallback>
                                                                                        </Avatar>
                                                                                        <span className="text-[10px] font-medium">
                                                                                            {version.createdBy.name || version.createdBy.email?.split('@')[0] || 'Unknown'}
                                                                                        </span>
                                                                                    </div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent side="top" className="text-xs">
                                                                                    <p>{version.createdBy.email || 'No email available'}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    )}
                                                                    <span>•</span>
                                                                    <span>{version.isManual ? "Manual" : "Auto"}</span>
                                                                    {(version.insertions !== undefined && version.deletions !== undefined) && (version.insertions > 0 || version.deletions > 0) && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="flex items-center gap-1 font-mono text-[9px] px-1 py-0.5 rounded bg-muted/50">
                                                                                {version.insertions > 0 && (
                                                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{version.insertions}</span>
                                                                                )}
                                                                                {version.deletions > 0 && (
                                                                                    <span className="text-red-600 dark:text-red-400 font-semibold">-{version.deletions}</span>
                                                                                )}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Hover Actions */}
                                                                {idx !== 0 && (
                                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                        <TooltipProvider delayDuration={0}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            openRenameDialog(version.id);
                                                                                        }}
                                                                                    >
                                                                                        <IconPencil className="w-3.5 h-3.5" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Rename version</TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>

                                                                        <TooltipProvider delayDuration={0}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setConfirmDeleteId(version.id);
                                                                                        }}
                                                                                    >
                                                                                        <IconTrash className="w-3.5 h-3.5" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Delete version</TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ))}

                                            {/* "The Beginning" footer */}
                                            <div className="mt-4 px-4 py-3 flex items-center gap-2.5 opacity-50">
                                                <div className="w-6 h-6 rounded bg-blue-500 overflow-hidden flex items-center justify-center shrink-0">
                                                    <div className="w-full h-full bg-[url('https://avatar.vercel.sh/paper')] bg-cover opacity-50" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium">The Beginning</span>
                                                    <span className="text-[9px] uppercase tracking-wide font-semibold">Document Created</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons at Bottom - Sticky */}
                            <div className="p-4 shrink-0 space-y-2 bg-background border-t sticky bottom-0 z-10">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={() => previewVersionId && handleMakeCopy(previewVersionId)}
                                    disabled={!previewVersionId || copyingId !== null}
                                >
                                    {copyingId === previewVersionId ? (
                                        <>
                                            <IconLoader2 className="w-4 h-4 animate-spin" />
                                            Making copy...
                                        </>
                                    ) : (
                                        <>
                                            <IconCopyPlus className="w-4 h-4" />
                                            Make a copy
                                        </>
                                    )}
                                </Button>
                                <Button
                                    className="w-full justify-start gap-2"
                                    onClick={() => previewVersionId && setConfirmRestoreId(previewVersionId)}
                                    disabled={!previewVersionId || restoringId !== null}
                                >
                                    {restoringId === previewVersionId ? (
                                        <>
                                            <IconLoader2 className="w-4 h-4 animate-spin" />
                                            Restoring...
                                        </>
                                    ) : (
                                        <>
                                            <IconRestore className="w-4 h-4" />
                                            Restore this version
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={handleCreateSnapshot}
                                    disabled={snapshotting}
                                >
                                    {snapshotting ? (
                                        <>
                                            <IconLoader2 className="w-4 h-4 animate-spin" />
                                            Creating snapshot...
                                        </>
                                    ) : (
                                        <>
                                            <IconGitBranch className="w-4 h-4" />
                                            Create manual snapshot
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KEEP RESTORE/DELETE ALERTS AS THEY WERE */}
            <AlertDialog open={!!confirmRestoreId} onOpenChange={(open) => !open && setConfirmRestoreId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore this version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will overwrite the current content of your paper with this snapshot.
                            Any unsaved work in the current session will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmRestoreId && handleRestore(confirmRestoreId)}>
                            Confirm Restore
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this snapshot?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This version will be permanently removed from your history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Forever
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={(open) => {
                if (!open && !renaming) {
                    setRenameDialogOpen(false)
                    setRenameValue('')
                    setRenamingVersionId(null)
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Version</DialogTitle>
                        <DialogDescription>
                            Give this version a custom name (max 100 characters). The name will be encrypted before saving.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        placeholder="Enter version name"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        maxLength={100}
                        disabled={renaming}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameValue.trim()) {
                                handleRenameVersion()
                            }
                        }}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={renaming}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameVersion} disabled={!renameValue.trim() || renaming}>
                            {renaming ? (
                                <>
                                    <IconLoader2 className="w-4 h-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
