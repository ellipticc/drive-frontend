"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    IconPlus,
    IconFileUpload,
    IconFolderDown,
    IconBrandGoogleDrive,
    IconFolderPlus,
    IconStackFilled
} from "@tabler/icons-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useGoogleDrive } from "@/hooks/use-google-drive"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar"
import { CreateFolderModal } from "@/components/modals/create-folder-modal"
import { useGlobalUpload } from "@/components/global-upload-context"

import { paperService } from "@/lib/paper-service"
import { masterKeyManager } from "@/lib/master-key"
import { toast } from "sonner"

interface NavNewProps {
    onFileUpload?: () => void
    onFolderUpload?: () => void
}

export function NavNew({ onFileUpload, onFolderUpload }: NavNewProps) {
    const { t } = useLanguage()
    const router = useRouter()
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
    const { openPicker } = useGoogleDrive()
    const { notifyFileAdded } = useGlobalUpload()

    const handleNewPaper = async () => {
        try {
            if (!masterKeyManager.hasMasterKey()) {
                toast.error("Encryption key missing. Please login.")
                return
            }

            toast.info("Creating new paper...")

            const now = new Date()
            const pad = (n: number) => n.toString().padStart(2, '0')
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
            const timeStr = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`
            const filename = `Untitled document ${dateStr} ${timeStr}`

            const fileId = await paperService.createPaper(filename, undefined, null)

            router.push(`/paper/${fileId}`)
        } catch (error) {
            console.error("Failed to create paper:", error)
            toast.error("Failed to create paper")
        }
    }

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                                tooltip={t("common.new")}
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground transition-colors shadow-sm"
                            >
                                <IconPlus className="size-4 shrink-0" />
                                <span className="font-medium">{t("common.new")}</span>
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem onClick={onFileUpload} className="cursor-pointer">
                                <IconFileUpload className="me-2 h-4 w-4" />
                                {t("files.uploadFile")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onFolderUpload} className="cursor-pointer">
                                <IconFolderDown className="me-2 h-4 w-4" />
                                {t("files.uploadFolder")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={openPicker} className="cursor-pointer">
                                <IconBrandGoogleDrive className="me-2 h-4 w-4" stroke={1.5} />
                                Import from Google Drive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setIsCreateFolderOpen(true)} className="cursor-pointer">
                                <IconFolderPlus className="me-2 h-4 w-4" />
                                {t("files.newFolder")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleNewPaper} className="cursor-pointer">
                                <IconStackFilled className="me-2 h-4 w-4" />
                                {t("files.newPaper")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            <CreateFolderModal
                open={isCreateFolderOpen}
                onOpenChange={setIsCreateFolderOpen}
                onFolderCreated={(folder) => {
                    if (folder) {
                        notifyFileAdded(folder)
                    } else {
                        router.refresh()
                    }
                }}
            />
        </>
    )
}
