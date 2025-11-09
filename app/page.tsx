"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/team-members-table"
import { DragDropOverlay } from "@/components/drag-drop-overlay"
import {
  SidebarInset,
} from "@/components/ui/sidebar"
import { keyManager } from "@/lib/key-manager"
import { useUser } from "@/components/user-context"

export default function Home() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop state - simplified
  const [isDragOverlayVisible, setIsDragOverlayVisible] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<{ files: File[], folders: FileList | null } | null>(null)

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
        // Use user from context (already fetched by UserProvider)
        if (user?.crypto_keypairs) {
          await keyManager.initialize(user)
          // console.log('🔐 KeyManager initialized on main page')
        } else {
          // console.warn('Failed to initialize key manager - user crypto keypairs not available')
        }
      } catch (error) {
        // console.error('Failed to initialize key manager:', error)
      }
    }

    initializeKeyManager()
  }, [user])

  // Drag and drop handlers - simplified
  const handleDrop = useCallback((files: FileList) => {
    // Convert FileList to array and separate files and folders
    const fileArray = Array.from(files)
    const regularFiles = fileArray.filter(file => !file.webkitRelativePath || file.webkitRelativePath === file.name)
    const folderFiles = fileArray.filter(file => file.webkitRelativePath && file.webkitRelativePath !== file.name)

    // Set dropped files for the table component to handle
    setDroppedFiles({
      files: regularFiles,
      folders: folderFiles.length > 0 ? (() => {
        // Create a new FileList-like object for folders
        const dt = new DataTransfer()
        folderFiles.forEach(file => dt.items.add(file))
        return dt.files
      })() : null
    })

    // Reset drag state
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
      <SiteHeader pageTitle="My Files" onSearch={handleSearch} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Table01DividerLineSm searchQuery={searchQuery} dragDropFiles={droppedFiles || undefined} />
            
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
              {...({ webkitdirectory: "" } as any)}
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
