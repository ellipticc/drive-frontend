"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { SectionCards } from "@/components/shared/section-cards"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/team-members-table"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { keyManager } from "@/lib/key-manager"
import { apiClient } from "@/lib/api"

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

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
        // Get user profile to initialize key manager
        const profileResponse = await apiClient.getProfile()
        if (profileResponse.success && profileResponse.data?.user?.crypto_keypairs) {
          await keyManager.initialize(profileResponse.data.user)
          // console.log('🔐 KeyManager initialized on main page')
        } else {
          // console.warn('Failed to get user profile for key manager initialization')
        }
      } catch (error) {
        // console.error('Failed to initialize key manager:', error)
      }
    }

    initializeKeyManager()
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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} />
      <SidebarInset>
        <SiteHeader pageTitle="My Files" onSearch={handleSearch} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <Table01DividerLineSm searchQuery={searchQuery} />
              
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
      </SidebarInset>
    </SidebarProvider>
  )
}
