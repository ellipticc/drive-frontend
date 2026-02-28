"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { IconChevronDown, IconLoader2, IconStackFilled } from "@tabler/icons-react"
import {
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar,
} from "@/components/ui/sidebar"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { apiClient, FileItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { useLanguage } from "@/lib/i18n/language-context"
import { cn } from "@/lib/utils"

export function NavDrafts({ item }: { item: any }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { state, toggleSidebar } = useSidebar()
    const { t } = useLanguage()

    const [isOpen, setIsOpen] = React.useState(() => {
        if (typeof window !== "undefined") {
            return sessionStorage.getItem("drafts-expanded") === "true"
        }
        return false
    })
    const [isHovered, setIsHovered] = React.useState(false)

    const [papers, setPapers] = React.useState<FileItem[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [hasLoaded, setHasLoaded] = React.useState(false)
    const [isLeaf, setIsLeaf] = React.useState(false)

    const fetchPapers = React.useCallback(async () => {
        if (hasLoaded) return
        setIsLoading(true)
        try {
            // Fetch files from root
            // We filter for papers on the client side since API does not support strict type filtering yet
            const folderId = "root";
            const response = await apiClient.getFolderContents(folderId)

            if (response.success && response.data) {
                const masterKey = masterKeyManager.hasMasterKey() ? masterKeyManager.getMasterKey() : null

                // Filter for papers and decrypt names
                const files = response.data.files || []

                const paperFiles = await Promise.all(
                    files
                        // Filter by mimeType
                        .filter(f => f.mimeType === 'application/x-paper' || f.mimetype === 'application/x-paper')
                        .map(async (f) => {
                            let name = "Untitled Paper"
                            try {
                                if (f.encryptedFilename && masterKey && f.filenameSalt) {
                                    name = await decryptFilename(f.encryptedFilename, f.filenameSalt, masterKey)
                                } else if (f.filename) {
                                    name = f.filename
                                }
                            } catch (err) {
                                console.error("Failed to decrypt paper name", err)
                            }
                            // Normalize to FileItem shape expected by state
                            return {
                                ...f,
                                name,
                                type: 'paper' as const, // Force type for UI logic
                                mimeType: f.mimeType || f.mimetype
                            }
                        })
                )

                setPapers(paperFiles as any)
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



    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                tooltip={{
                    children: (
                        <div className="flex items-center gap-2">
                            <span>{item.title}</span>
                            <Kbd className="h-5">D</Kbd>
                        </div>
                    )
                }}
                isActive={pathname === item.url && !searchParams.has('fileId')}
                className="cursor-pointer group/nav-item group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 pl-2"
                data-space-id="draft"
                data-space-name={t("sidebar.drafts")}
            >
                <Link href={item.url}>
                    {!isLeaf ? (
                        <div
                            role="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (state !== 'collapsed') {
                                    toggleOpen(e)
                                }
                            }}
                            className={cn(
                                "flex items-center justify-center rounded-sm transition-colors",
                                state === 'collapsed' ? 'cursor-default pointer-events-auto' : 'hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer'
                            )}
                        >
                            {isHovered && state !== 'collapsed' ? (
                                <IconChevronDown
                                    className={cn("size-4 shrink-0 transition-transform duration-200", !isOpen && "-rotate-90")}
                                />
                            ) : (
                                item.icon && <item.icon className="shrink-0 size-4" />
                            )}
                        </div>
                    ) : (
                        item.icon && <item.icon />
                    )}
                    <span>{item.title}</span>
                    {state !== 'collapsed' && (
                        <div className="ms-auto opacity-0 group-hover/nav-item:opacity-100 transition-opacity">
                            <Kbd>{item.shortcut || 'D'}</Kbd>
                        </div>
                    )}
                </Link>
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
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={searchParams.get('fileId') === paper.id}
                                            className="cursor-pointer flex items-center gap-2"
                                        >
                                            <Link href={`/paper?fileId=${paper.id}`}>
                                                <IconStackFilled className="size-3.5 text-blue-500 !text-blue-500 shrink-0" />
                                                <span className="truncate text-xs font-medium">{paper.name}</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-[200px] break-words">
                                        {paper.name}
                                    </TooltipContent>
                                </Tooltip>
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
