"use client"

import React, { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { IconHistory, IconDeviceFloppy, IconRestore, IconTrash, IconLoader2, IconAlertTriangle, IconEye } from "@tabler/icons-react"
import { format } from "date-fns"
import { PaperPreview } from "@/components/previews/paper-preview"
import { masterKeyManager } from "@/lib/master-key"
import { paperService } from "@/lib/paper-service"
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

interface Version {
    id: string
    versionIndex: number
    createdAt: string
    totalSize: number
    expiresAt: string | null
    isManual: boolean
    triggerType: string
}

interface VersionHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    fileId: string
    onRestoreComplete: () => void
}

export function VersionHistoryModal({
    isOpen,
    onClose,
    fileId,
    onRestoreComplete
}: VersionHistoryModalProps) {
    const [versions, setVersions] = useState<Version[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [restoringId, setRestoringId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)
    const [previewContent, setPreviewContent] = useState<any>(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    // Confirmation states
    const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const fetchVersions = async () => {
        setLoading(true)
        try {
            const res = await apiClient.getPaperVersions(fileId)
            if (res.success && res.data) {
                setVersions(res.data.versions)
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

    const handlePreview = async (version: Version) => {
        setPreviewVersionId(version.id)
        setPreviewLoading(true)
        setPreviewContent(null)

        try {
            const paperData = await paperService.getPaperVersion(fileId, version.id)
            setPreviewContent(paperData.content)
        } catch (e) {
            console.error(e)
            toast.error("Failed to load preview")
            setPreviewVersionId(null)
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
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <IconHistory className="w-5 h-5" />
                            Version History
                        </DialogTitle>
                        <DialogDescription>
                            View, restore, or delete previous versions of this document.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Action Bar */}
                        <div className="p-4 bg-muted/30 border-b flex justify-between items-center shrink-0">
                            <span className="text-sm text-muted-foreground font-medium">Current State</span>
                            <Button
                                size="sm"
                                onClick={handleSaveVersion}
                                disabled={saving}
                                className="gap-2"
                            >
                                {saving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconDeviceFloppy className="w-4 h-4" />}
                                Save New Version
                            </Button>
                        </div>

                        {/* List */}
                        <ScrollArea className="flex-1">
                            <div className="p-0">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                        <IconLoader2 className="w-8 h-8 animate-spin" />
                                        <p>Loading versions...</p>
                                    </div>
                                ) : versions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                        <IconHistory className="w-12 h-12 opacity-20" />
                                        <p>No saved versions yet.</p>
                                        <p className="text-xs max-w-xs text-center">Save a version manually or wait for auto-snapshots (if configured).</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {versions.map((version) => (
                                            <div key={version.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">
                                                            {version.isManual ? 'Manual Save' : `Auto Snapshot (${version.triggerType})`}
                                                            <span className="ml-2 text-muted-foreground font-normal">#{version.versionIndex}</span>
                                                        </span>
                                                        {version.expiresAt && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                                                                Expires {format(new Date(version.expiresAt), 'MMM d')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(version.createdAt), 'MMM d, yyyy • h:mm a')} • {formatSize(version.totalSize)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 px-0"
                                                        onClick={() => handlePreview(version)}
                                                        title="Preview Version"
                                                    >
                                                        <IconEye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs gap-1.5"
                                                        onClick={() => setConfirmRestoreId(version.id)}
                                                        disabled={restoringId === version.id}
                                                    >
                                                        <IconRestore className="w-3.5 h-3.5" />
                                                        Restore
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setConfirmDeleteId(version.id)}
                                                        disabled={deletingId === version.id}
                                                    >
                                                        {deletingId === version.id ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconTrash className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Restore Confirmation */}
            <AlertDialog open={!!confirmRestoreId} onOpenChange={(open) => !open && setConfirmRestoreId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore this version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will overwrite the current content of your paper with the selected version.
                            The current state will be lost unless you save it as a version first.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmRestoreId && handleRestore(confirmRestoreId)}>
                            Restore
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This version snapshot will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Preview Modal */}
            <Dialog open={!!previewVersionId} onOpenChange={(open) => !open && setPreviewVersionId(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle>Version Preview</DialogTitle>
                            <DialogDescription>
                                Viewing a read-only snapshot of this version.
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2 mr-6">
                            {previewVersionId && (
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setConfirmRestoreId(previewVersionId);
                                        setPreviewVersionId(null);
                                    }}
                                >
                                    <IconRestore className="w-4 h-4 mr-2" />
                                    Restore This Version
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden bg-background">
                        {previewVersionId && (
                            /* We pass loading state or content. For now placeholders.
                               In real implementation, we would pass the fetched content */
                            <PaperPreview fileId={fileId} initialContent={previewContent} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
