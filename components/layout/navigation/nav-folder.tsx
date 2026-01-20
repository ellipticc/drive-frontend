"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconChevronRight, IconFolder, IconLoader2 } from "@tabler/icons-react"
import {
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton
} from "@/components/ui/sidebar"
import { apiClient, FolderContentItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { useLanguage } from "@/lib/i18n/language-context"
import { cn } from "@/lib/utils"

interface NavFolderProps {
    folder: {
        id: string
        name: string
        parentId: string | null
    }
    level?: number
}

export function NavFolder({ folder, level = 0 }: NavFolderProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [isOpen, setIsOpen] = React.useState(() => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem(`folder_open_${folder.id}`)
            return saved === "true"
        }
        return false
    })
    const [subfolders, setSubfolders] = React.useState<FolderContentItem[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [hasLoaded, setHasLoaded] = React.useState(false)
    const [isLeaf, setIsLeaf] = React.useState(false)

    const fetchSubfolders = React.useCallback(async () => {
        if (hasLoaded) return
        setIsLoading(true)
        try {
            const response = await apiClient.getFolderContents(folder.id)
            if (response.success && response.data) {
                const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null

                const decryptedFolders = await Promise.all(
                    response.data.folders.map(async (f) => {
                        let name = "Encrypted Folder"
                        try {
                            if (masterKey) {
                                name = await decryptFilename(f.encryptedName, f.nameSalt, masterKey)
                            }
                        } catch (err) {
                            console.error("Failed to decrypt folder name in sidebar", err)
                        }
                        return { ...f, name }
                    })
                )
                setSubfolders(decryptedFolders)
                setHasLoaded(true)
                if (decryptedFolders.length === 0) {
                    setIsLeaf(true)
                    setIsOpen(false)
                }
            } else {
                setIsLeaf(true)
            }
        } catch (error) {
            console.error("Failed to fetch subfolders", error)
        } finally {
            setIsLoading(false)
        }
    }, [folder.id, hasLoaded])

    React.useEffect(() => {
        if (isOpen && !hasLoaded) {
            fetchSubfolders()
        }
    }, [isOpen, hasLoaded, fetchSubfolders])

    const toggleOpen = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const nextState = !isOpen
        setIsOpen(nextState)
        sessionStorage.setItem(`folder_open_${folder.id}`, String(nextState))
    }

    const handleNavigate = (e: React.MouseEvent) => {
        e.preventDefault()
        router.push(`/?folderId=${folder.id}`)
    }

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild>
                <button
                    onClick={handleNavigate}
                    className="flex items-center gap-2 flex-1 min-w-0 pr-8 relative group/folder-btn"
                >
                    <IconFolder className="size-4 !text-blue-500 shrink-0" />
                    <span className="truncate text-xs font-medium">{folder.name}</span>
                    {!isLeaf && (
                        <div
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleOpen(e)
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm transition-colors text-muted-foreground/40 hover:text-muted-foreground z-20"
                        >
                            <IconChevronRight
                                className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-90")}
                            />
                        </div>
                    )}
                </button>
            </SidebarMenuSubButton>

            {isOpen && !isLeaf && (
                <SidebarMenuSub className="ml-3.5 border-l border-border/50">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground italic">
                            <IconLoader2 className="size-3 animate-spin" />
                            {t("sidebar.loading")}
                        </div>
                    ) : subfolders.length > 0 ? (
                        subfolders.map((sub) => (
                            <NavFolder
                                key={sub.id}
                                folder={{ id: sub.id, name: sub.name || "Untitled", parentId: sub.parentId }}
                                level={level + 1}
                            />
                        ))
                    ) : null}
                </SidebarMenuSub>
            )}
        </SidebarMenuSubItem>
    )
}
