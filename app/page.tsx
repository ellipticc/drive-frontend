"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/files-table"
import { DragDropOverlay } from "@/components/drag-drop-overlay"
import { keyManager } from "@/lib/key-manager"

// Extended File interface to include webkitRelativePath
interface ExtendedFile extends File {
  webkitRelativePath: string;
}
import { useUser } from "@/components/user-context"

export default function Home() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop state - simplified
  const [isDragOverlayVisible, setIsDragOverlayVisible] = useState(false)
  // folders can be FileList (from input) or File[] (from drag & drop) - both preserve webkitRelativePath
  const [droppedFiles, setDroppedFiles] = useState<{ files: File[], folders: FileList | File[] | null } | null>(null)

  // Set page title
  useLayoutEffect(() => {
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
        if (user?.crypto_keypairs) {
          await keyManager.initialize(user)
        }
      } catch {
      }
    }

    initializeKeyManager()
  }, [user])

  // Handle drag and drop files
  const handleDrop = useCallback((files: File[] | FileList) => {
    const fileArray = Array.isArray(files) ? files as ExtendedFile[] : Array.from(files) as ExtendedFile[]

    fileArray.forEach((f, i) => {
      const relativePath = (f as any).webkitRelativePath || '';
    });

    const validFiles = fileArray.filter(file => {
      if (!file.name || file.name.trim() === '') {
        return false;
      }
      return true;
    });

    const regularFiles = validFiles.filter(file => {
      const relativePath = (file as any).webkitRelativePath || '';
      return !relativePath;
    })
    const folderFiles = validFiles.filter(file => {
      const relativePath = (file as any).webkitRelativePath || '';
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

    document.addEventListener('dragenter', handleGlobalDragEnter)
    document.addEventListener('dragleave', handleGlobalDragLeave)
    window.addEventListener('dragend', handleGlobalDragEnd)

    return () => {
      document.removeEventListener('dragenter', handleGlobalDragEnter)
      document.removeEventListener('dragleave', handleGlobalDragLeave)
      window.removeEventListener('dragend', handleGlobalDragEnd)
    }
  }, [])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFolderUpload = () => {
    folderInputRef.current?.click()
  }

  return (
    <>
      <SiteHeader
        onSearch={handleSearch}
        onFileUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Table01DividerLineSm
              searchQuery={searchQuery}
              dragDropFiles={droppedFiles || undefined}
              onDragDropProcessed={() => {
                setDroppedFiles(null);
              }}
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
                if (tableFolderInput && e.target.files) {
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
    </>
  )
}
