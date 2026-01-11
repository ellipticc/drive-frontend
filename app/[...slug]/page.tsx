"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { SectionCards } from "@/components/shared/section-cards"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/files-table"
import { DragDropOverlay } from "@/components/drag-drop-overlay"
import {
  SidebarInset,
} from "@/components/ui/sidebar"
import { keyManager } from "@/lib/key-manager"
import { useUser } from "@/components/user-context"

export default function Home() {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [uploadHandlers, setUploadHandlers] = useState<{ handleFileUpload: () => void; handleFolderUpload: () => void } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop state - simplified
  // folders can be FileList (from input) or File[] (from drag & drop) - both preserve webkitRelativePath
  const [isDragOverlayVisible, setIsDragOverlayVisible] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<{ files: File[], folders: FileList | File[] | null } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    document.title = "My Files - Ellipticc Drive"
  }, [])

  // Initialize key manager if not already initialized (for post-registration users)
  useEffect(() => {
    const initializeKeyManager = async () => {
      // Skip if already initialized
      if (keyManager.hasKeys()) {
        return
      }

      try {
        // Use user from context (already fetched by UserProvider)
        if (user?.crypto_keypairs) {
          await keyManager.initialize(user)
          // console.log('🔐 KeyManager initialized on folder page')
        } else {
          // console.warn('Failed to initialize key manager - user crypto keypairs not available')
        }
      } catch {
        // console.error('Failed to initialize key manager:', error)
      }
    }

    initializeKeyManager()
  }, [user])

  // Extended File interface to include webkitRelativePath
  interface ExtendedFile extends File {
    webkitRelativePath: string;
  }

  // Drag and drop handlers
  const handleDrop = useCallback((files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files as ExtendedFile[] : Array.from(files) as ExtendedFile[]

    // Filter out suspicious entries (empty name)
    const validFiles = fileArray.filter(file => {
      if (!file.name || file.name.trim() === '') {
        return false;
      }
      return true;
    });

    const regularFiles = validFiles.filter(file => {
      const relativePath = (file as any).webkitRelativePath || '';
      return !relativePath; // Files with no relative path (root files)
    })
    const folderFiles = validFiles.filter(file => {
      const relativePath = (file as any).webkitRelativePath || '';
      return !!relativePath; // Files with relative path (inside folder structure)
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
    document.addEventListener('drop', handleGlobalDrop, true)
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

  // Sync search param from URL
  useEffect(() => {
    const q = searchParams.get('q');
    setSearchQuery(q || "");
  }, [searchParams]);

  return (
    <SidebarInset
      onDragEnter={(e) => {
        if (!searchParams.get('preview')) {
          setIsDragOverlayVisible(true)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (!searchParams.get('preview')) {
          handleDrop(e.dataTransfer.files)
        }
      }}
    >
      <SiteHeader
        onSearch={handleSearch}
        searchValue={searchQuery}
        onFileUpload={uploadHandlers?.handleFileUpload}
        onFolderUpload={uploadHandlers?.handleFolderUpload}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards />
            <Table01DividerLineSm
              searchQuery={searchQuery}
              onUploadHandlersReady={setUploadHandlers}
              dragDropFiles={droppedFiles || undefined}
            />

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                // This will be handled by the table component
                // We just need to trigger the change event
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
                // This will be handled by the table component
                const tableFolderInput = document.querySelector('input[type="file"][webkitdirectory]') as HTMLInputElement
                if (tableFolderInput) {
                  tableFolderInput.files = e.target.files
                  tableFolderInput.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }}
              {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string })}
            />
          </div>
        </div>
      </div>
      <DragDropOverlay
        isVisible={isDragOverlayVisible}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
    </SidebarInset>
  )
}