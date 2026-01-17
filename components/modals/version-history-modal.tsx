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

    // Auto-select latest version on load
    useEffect(() => {
        if (versions.length > 0 && !previewVersionId) {
            handlePreview(versions[0]);
        }
    }, [versions, previewVersionId]);

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
                <DialogContent className="max-w-[95vw] h-[95vh] flex flex-row p-0 gap-0 overflow-hidden border-none shadow-2xl">

                    {/* LEFT: Preview Area */}
                    <div className="flex-1 bg-muted/30 flex flex-col relative h-full">
                        {/* Header Overlay */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                            <div className="bg-background/80 backdrop-blur-md border rounded-md px-3 py-1.5 shadow-sm text-sm font-medium flex items-center gap-2">
                                <IconHistory className="w-4 h-4 text-muted-foreground" />
                                {previewVersionId ?
                                    versions.find(v => v.id === previewVersionId)?.isManual
                                        ? "Manual Save Preview"
                                        : `Version #${versions.find(v => v.id === previewVersionId)?.versionIndex} Preview`
                                    : "Select a version"}
                            </div>
                            {previewLoading && <IconLoader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        </div>

                        {/* Preview Content */}
                        <div className="flex-1 overflow-hidden relative w-full h-full flex items-center justify-center p-8">
                            {previewContent ? (
                                <div className="bg-background shadow-lg rounded-xl border w-full max-w-4xl h-full overflow-hidden relative">
                                    <PaperPreview fileId={fileId} initialContent={previewContent} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground opacity-50">
                                    <IconEye className="w-12 h-12" />
                                    <p>Select a version to preview</p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Action Bar for Restore */}
                        {previewVersionId && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                                <Button
                                    size="lg"
                                    className="shadow-xl rounded-full px-8 gap-2 bg-primary hover:bg-primary/90 transition-all font-semibold"
                                    onClick={() => setConfirmRestoreId(previewVersionId)}
                                >
                                    <IconRestore className="w-5 h-5" />
                                    Restore This Version
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Sidebar */}
                    <div className="w-[350px] flex flex-col border-l h-full bg-background z-20 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.1)]">
                        <DialogHeader className="px-6 py-5 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                Version History
                            </DialogTitle>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 ml-auto rounded-full">
                                <IconTrash className="w-4 h-4 opacity-0" />
                            </Button>
                        </DialogHeader>

                        {/* Current State Checkpoint */}
                        <div className="p-4 border-b bg-muted/10 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current State</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSaveVersion}
                                    disabled={saving}
                                    className="h-7 text-xs gap-1.5"
                                >
                                    {saving ? <IconLoader2 className="w-3 h-3 animate-spin" /> : <IconDeviceFloppy className="w-3 h-3" />}
                                    Save Now
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Save a manual version to create a restore point.
                            </p>
                        </div>

                        <ScrollArea className="flex-1">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                    <IconLoader2 className="w-8 h-8 animate-spin" />
                                    <p>Loading...</p>
                                </div>
                            ) : versions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground text-center px-4">
                                    <IconHistory className="w-10 h-10 opacity-20" />
                                    <p className="text-sm font-medium">No history</p>
                                    <p className="text-xs">Versions will appear here automatically.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {versions.map((version) => (
                                        <button
                                            key={version.id}
                                            onClick={() => handlePreview(version)}
                                            className={`text-left p-4 border-b transition-all hover:bg-muted/50 block group relative ${previewVersionId === version.id ? "bg-muted border-l-4 border-l-primary pl-3" : "pl-4"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <div className="font-semibold text-sm flex items-center gap-2">
                                                    {version.isManual ? "Manual Save" : version.triggerType === 'share' ? "Share Snapshot" : version.triggerType === 'export' ? "Export Snapshot" : version.triggerType === 'close' ? "Close Snapshot" : "Auto Snapshot"}
                                                </div>
                                                {version.expiresAt && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-tight ${new Date(version.expiresAt) < new Date(Date.now() + 86400000)
                                                        ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 font-bold"
                                                        : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {new Date(version.expiresAt) < new Date(Date.now() + 86400000 * 2) ? 'Expiring Soon' : format(new Date(version.expiresAt), 'MMM d')}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                                                <span>{format(new Date(version.createdAt), 'h:mm a')}</span>
                                                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                                                <span>{(new Date(version.createdAt)).toLocaleDateString() === new Date().toLocaleDateString() ? 'Today' : format(new Date(version.createdAt), 'MMM d')}</span>
                                                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                                                <span>{formatSize(version.totalSize)}</span>
                                            </div>

                                            {/* Quick Actions on Hover */}
                                            <div className="flex items-center gap-1 mt-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                {previewVersionId !== version.id && (
                                                    <span className="text-[10px] text-primary font-medium mr-auto">Click to preview</span>
                                                )}

                                                <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmDeleteId(version.id);
                                                        }}
                                                        title="Delete Version"
                                                    >
                                                        <IconTrash className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

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
        </>
    )
}
