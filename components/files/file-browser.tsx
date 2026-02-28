"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback, Suspense } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/files-table"
import { DragDropOverlay } from "@/components/drag-drop-overlay"
import { keyManager } from "@/lib/key-manager"
import { useUser } from "@/components/user-context"

// Extended File interface to include webkitRelativePath
interface ExtendedFile extends File {
    webkitRelativePath: string;
}

interface FileBrowserProps {
    filterMode?: 'default' | 'recents';
    pageTitle?: string;
    initialFolderId?: string;
}

export function FileBrowser({ filterMode = 'default', pageTitle = "Vault", initialFolderId }: FileBrowserProps) {
    const { user } = useUser()
    const router = useRouter()
    const pathname = usePathname()
    const [searchQuery, setSearchQuery] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const folderInputRef = useRef<HTMLInputElement>(null)

    // Drag and drop state - simplified
    const [isDragOverlayVisible, setIsDragOverlayVisible] = useState(false)
    // folders can be FileList (from input) or File[] (from drag & drop) - both preserve webkitRelativePath
    const [droppedFiles, setDroppedFiles] = useState<{ files: File[], folders: FileList | File[] | null } | null>(null)
    const searchParams = useSearchParams()

    // Set page title
    useLayoutEffect(() => {
        document.title = `${pageTitle} - Ellipticc Drive`
    }, [pageTitle])

    // Initialize key manager if not already initialized (for post-registration users)
    useEffect(() => {
        const initializeKeyManager = async () => {
            // Skip if already initialized
            if (keyManager.hasKeys()) {
                return
            }

            try {
                if (user?.crypto_keypairs) {
                    await keyManager.initialize(user)
                }
            } catch {
            }
        }

        initializeKeyManager()
    }, [user])

    // Sync search param from URL
    useEffect(() => {
        const q = searchParams.get('q');
        setSearchQuery(q || "");
    }, [searchParams]);

    // Handle drag and drop files
    const handleDrop = useCallback((files: File[] | FileList) => {
        const fileArray = Array.isArray(files) ? files as ExtendedFile[] : Array.from(files) as ExtendedFile[]

        const validFiles = fileArray.filter(file => {
            if (!file.name || file.name.trim() === '') {
                return false;
            }
            return true;
        });

        const regularFiles = validFiles.filter(file => {
            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
            return !relativePath;
        })
        const folderFiles = validFiles.filter(file => {
            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
            return !!relativePath;
        })

        setDroppedFiles({
            files: regularFiles,
            folders: folderFiles.length > 0 ? folderFiles : null
        })

        setIsDragOverlayVisible(false)
    }, [])

    const handleDragLeave = useCallback(() => {
        setIsDragOverlayVisible(false)
    }, [])

    // Show overlay on drag enter anywhere on the page
    useEffect(() => {
        let dragCounter = 0

        const handleGlobalDragEnter = (e: DragEvent) => {
            // Disable drag overlay if preview modal is open
            if (searchParams.get('preview')) return;

            if (e.dataTransfer?.types.includes('Files')) {
                dragCounter++
                setIsDragOverlayVisible(true)
            }
        }

        const handleGlobalDragLeave = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) {
                dragCounter--
                if (dragCounter <= 0) {
                    dragCounter = 0
                    setIsDragOverlayVisible(false)
                }
            }
        }

        const handleGlobalDragEnd = () => {
            dragCounter = 0
            setIsDragOverlayVisible(false)
        }

        const handleGlobalDragOver = (e: DragEvent) => {
            if (searchParams.get('preview')) {
                e.preventDefault()
                e.stopPropagation()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
            }
        }

        const handleGlobalDrop = (e: DragEvent) => {
            if (searchParams.get('preview')) {
                e.preventDefault()
                e.stopPropagation()
            }
        }

        document.addEventListener('dragenter', handleGlobalDragEnter)
        document.addEventListener('dragleave', handleGlobalDragLeave)
        document.addEventListener('dragover', handleGlobalDragOver)
        document.addEventListener('drop', handleGlobalDrop, true) // Capture to block everything
        window.addEventListener('dragend', handleGlobalDragEnd)

        return () => {
            document.removeEventListener('dragenter', handleGlobalDragEnter)
            document.removeEventListener('dragleave', handleGlobalDragLeave)
            document.removeEventListener('dragover', handleGlobalDragOver)
            document.removeEventListener('drop', handleGlobalDrop, true)
            window.removeEventListener('dragend', handleGlobalDragEnd)
        }
    }, [searchParams])

    const handleSearch = (query: string) => {
        setSearchQuery(query)
        const params = new URLSearchParams(searchParams.toString())
        if (query) {
            params.set('q', query)
        } else {
            params.delete('q')
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex w-full h-full flex-col overflow-hidden">
            <SiteHeader
                sticky
            />
            <main className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <Table01DividerLineSm
                            searchQuery={searchQuery}
                            dragDropFiles={droppedFiles || undefined}
                            onDragDropProcessed={() => {
                                setDroppedFiles(null);
                            }}
                            filterMode={filterMode}
                            initialFolderId={initialFolderId}
                        />

                        {/* Hidden file inputs */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const tableFileInput = document.querySelector('input[type="file"][multiple]:not([webkitdirectory])') as HTMLInputElement
                                if (tableFileInput) {
                                    tableFileInput.files = e.target.files
                                    tableFileInput.dispatchEvent(new Event('change', { bubbles: true }))
                                }
                            }}
                            accept="*/*"
                        />
                        <input
                            ref={folderInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const tableFolderInput = document.querySelector('input[type="file"][webkitdirectory]') as HTMLInputElement
                                if (tableFolderInput && e.target.files) {
                                    tableFolderInput.files = e.target.files
                                    tableFolderInput.dispatchEvent(new Event('change', { bubbles: true }))
                                }
                            }}
                            {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string })}
                        />
                    </div>
                </div>
            </main>
            <DragDropOverlay
                isVisible={isDragOverlayVisible}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            />
        </div>
    )
}
