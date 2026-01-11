"use client"

import { useState, useEffect } from "react"
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
import { Slider } from "@/components/ui/slider"
import { IconLock, IconShieldLock, IconAlertCircle, IconCalendarPause } from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { truncateFilename } from "@/lib/utils"

interface LockItemModalProps {
    itemId?: string
    itemName?: string
    itemType?: "file" | "folder"
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onItemLocked?: () => void
}

export function LockItemModal({
    itemId = "",
    itemName = "item",
    itemType = "file",
    open,
    onOpenChange,
    onItemLocked
}: LockItemModalProps) {
    const [durationDays, setDurationDays] = useState<number>(30)
    const [totpToken, setTotpToken] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Wipe data on close
    useEffect(() => {
        if (!open) {
            const timer = setTimeout(() => {
                setDurationDays(30)
                setTotpToken("")
                setIsLoading(false)
            }, 300) // Reset after animation
            return () => clearTimeout(timer)
        }
    }, [open])

    const handleLock = async () => {
        if (!itemId || !itemType) return
        if (!totpToken || totpToken.length < 6) {
            toast.error("Please enter a valid 6-digit 2FA code")
            return
        }

        setIsLoading(true)
        try {
            let response;
            if (itemType === 'file') {
                response = await apiClient.lockFile(itemId, { durationDays, totpToken })
            } else {
                response = await apiClient.lockFolder(itemId, { durationDays, totpToken })
            }

            if (response.success) {
                toast.success(`${itemType === 'file' ? 'File' : 'Folder'} locked successfully for ${durationDays} days`)
                onOpenChange?.(false)
                onItemLocked?.()
                // Reset state
                setTotpToken("")
            } else {
                toast.error(response.error || `Failed to lock ${itemType}`)
            }
        } catch (error: unknown) {
            console.error("Failed to lock item:", error)
            toast.error(error instanceof Error ? error.message : `Failed to lock ${itemType}`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <IconShieldLock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle>File Retention (Immutability)</DialogTitle>
                            <DialogDescription className="mt-1">
                                Protect your data from deletion or modifications.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-3 text-amber-800 text-sm">
                        <IconAlertCircle className="h-5 w-5 shrink-0" />
                        <p>
                            <strong>Warning:</strong> Once locked, this item <strong>cannot</strong> be deleted or moved to trash until the lock period expires ({durationDays} days). This is enforced by server-side object locking.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-sm font-medium">Item to lock</p>
                        <p className="text-sm text-muted-foreground truncate bg-muted/50 p-2 rounded border border-border">
                            {truncateFilename(itemName)}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="duration" className="text-sm font-medium">
                                Retention Period
                            </Label>
                            <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <IconCalendarPause className="h-3.5 w-3.5" />
                                {durationDays} {durationDays === 1 ? 'Day' : 'Days'}
                            </span>
                        </div>
                        <Slider
                            id="duration"
                            min={1}
                            max={365} // Normal slider range 1 year
                            step={1}
                            value={[durationDays]}
                            onValueChange={(vals) => setDurationDays(vals[0])}
                            disabled={isLoading}
                            className="py-4"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                            <span>1 Day</span>
                            <span>30 Days</span>
                            <span>90 Days</span>
                            <span>180 Days</span>
                            <span>1 Year</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="totp">2FA Code</Label>
                        <Input
                            id="totp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={totpToken}
                            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            disabled={isLoading}
                            autoComplete="one-time-code"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange?.(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleLock}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            "Applying Lock..."
                        ) : (
                            <>
                                <IconLock className="h-4 w-4 mr-2" />
                                Lock Item
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
