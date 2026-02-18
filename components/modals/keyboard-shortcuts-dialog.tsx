"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { IconCommand, IconCornerDownLeft, IconArrowUp } from "@tabler/icons-react"

interface ShortcutItemProps {
    label: string
    keys: string[]
}

function ShortcutItem({ label, keys }: ShortcutItemProps) {
    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-1">
                {keys.map((key, index) => (
                    <kbd
                        key={index}
                        className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
                    >
                        {key === "Ctrl" ? <span className="text-xs">Ctrl</span> :
                            key === "Shift" ? <IconArrowUp className="h-3 w-3" /> :
                                key === "Enter" ? "Enter" :
                                    key}
                    </kbd>
                ))}
            </div>
        </div>
    )
}

interface KeyboardShortcutsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({
    open,
    onOpenChange,
}: KeyboardShortcutsDialogProps) {
    const [metaKey, setMetaKey] = React.useState("Ctrl")

    React.useEffect(() => {
        if (typeof navigator !== 'undefined') {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
            setMetaKey(isMac ? "⌘" : "Ctrl")
        }
    }, [])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden outline-none">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-lg font-semibold">Keyboard shortcuts</DialogTitle>
                </DialogHeader>

                <div className="px-6 py-4 space-y-6">
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium leading-none">General</h4>
                        <div className="grid gap-1">
                            <ShortcutItem label="Quick chat or search" keys={[metaKey, "K"]} />
                            <ShortcutItem label="Incognito chat" keys={["Shift", metaKey, "I"]} />
                            <ShortcutItem label="Toggle sidebar" keys={[metaKey, "B"]} />
                            <ShortcutItem label="Keyboard shortcuts" keys={[metaKey, "/"]} />
                            <ShortcutItem label="Settings" keys={["S"]} />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium leading-none">In chats</h4>
                        <div className="grid gap-1">
                            <ShortcutItem label="Send message" keys={["Enter"]} />
                            <ShortcutItem label="New line in message" keys={["Shift", "Enter"]} />
                            <ShortcutItem label="Toggle extended thinking" keys={["Shift", metaKey, "E"]} />
                            <ShortcutItem label="Upload file" keys={[metaKey, "U"]} />
                            <ShortcutItem label="Stop response" keys={["Esc"]} />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
