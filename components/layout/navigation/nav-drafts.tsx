"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { IconChevronRight, IconLoader2, IconWritingSign, IconWritingSignFilled, IconFileText } from "@tabler/icons-react"
import {
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar,
} from "@/components/ui/sidebar"
import { apiClient, FileItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { useLanguage } from "@/lib/i18n/language-context"
import { cn } from "@/lib/utils"

export function NavDrafts({ item }: { item: any }) {
    const router = useRouter()
    const pathname = usePathname()
    const { state, toggleSidebar } = useSidebar()
    const { t } = useLanguage()

    const [isOpen, setIsOpen] = React.useState(() => {
        if (typeof window !== "undefined") {
            return sessionStorage.getItem("drafts-expanded") === "true"
        }
        return false
    })

    const [papers, setPapers] = React.useState<FileItem[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [hasLoaded, setHasLoaded] = React.useState(false)
    const [isLeaf, setIsLeaf] = React.useState(false)

    const fetchPapers = React.useCallback(async () => {
        if (hasLoaded) return
        setIsLoading(true)
        try {
            // Fetch files from root (or general getFiles if acceptable)
            // We filter for papers on the client side since API might not support strict type filtering yet
            const response = await apiClient.getFiles({ limit: 100, folderId: 'root' })

            if (response.success && response.data) {
                const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null

                // Filter for papers and decrypt names
                const paperFiles = await Promise.all(
                    response.data.files
                        .filter(f => f.type === 'paper')
                        .map(async (f) => {
                            let name = "Untitled Paper"
                            try {
                                if (f.encryptedFilename && masterKey && f.filenameSalt) {
                                    name = await decryptFilename(f.encryptedFilename, f.filenameSalt, masterKey)
                                } else if (f.name) {
                                    name = f.name
                                }
                            } catch (err) {
                                console.error("Failed to decrypt paper name", err)
                            }
                            return { ...f, name }
                        })
                )

                setPapers(paperFiles)
                setHasLoaded(true)
                if (paperFiles.length === 0) {
                    setIsLeaf(true)
                    setIsOpen(false)
                }
            } else {
                setIsLeaf(true)
            }
        } catch (error) {
            console.error("Failed to fetch papers", error)
        } finally {
            setIsLoading(false)
        }
    }, [hasLoaded])

    React.useEffect(() => {
        if (isOpen && !hasLoaded) {
            fetchPapers()
        }
    }, [isOpen, hasLoaded, fetchPapers])

    const toggleOpen = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (state === "collapsed") {
            toggleSidebar()
            return
        }

        const nextState = !isOpen
        setIsOpen(nextState)
        sessionStorage.setItem("drafts-expanded", String(nextState))
    }

    const handleNavigate = (url: string) => {
        router.push(url)
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url || pathname.startsWith('/paper/')}
                onClick={() => handleNavigate(item.url)}
                className={cn(
                    "cursor-pointer relative",
                    state === 'collapsed' ? "" : "pr-8"
                )}
                data-space-id="draft"
                data-space-name={t("sidebar.drafts")}
            >
                {item.icon && <item.icon />}
                <span>{item.title}</span>

                {!isLeaf && state !== 'collapsed' && (
                    <div
                        onClick={toggleOpen}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm transition-colors text-muted-foreground/40 hover:text-muted-foreground z-20"
                    >
                        <IconChevronRight
                            className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-90")}
                        />
                    </div>
                )}
            </SidebarMenuButton>

            {isOpen && state !== 'collapsed' && (
                <SidebarMenuSub className="ml-3.5 border-l border-border/50">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground italic">
                            <IconLoader2 className="size-3 animate-spin" />
                            {t("sidebar.loading")}
                        </div>
                    ) : papers.length > 0 ? (
                        papers.map((paper) => (
                            <SidebarMenuSubItem key={paper.id}>
                                <SidebarMenuSubButton
                                    onClick={() => handleNavigate(`/paper/${paper.id}`)}
                                    className="cursor-pointer"
                                >
                                    <span className="truncate text-xs font-medium">{paper.name}</span>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))
                    ) : (
                        <div className="px-2 py-1 text-[10px] text-muted-foreground/60 italic">
                            {t("sidebar.empty")}
                        </div>
                    )}
                </SidebarMenuSub>
            )}
        </SidebarMenuItem>
    )
}
