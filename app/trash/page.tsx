"use client"

import { useState } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { TrashTable } from "@/components/tables/trash-table"
import { useGlobalUpload } from "@/components/global-upload-context"

export default function Trash() {
  const [searchQuery, setSearchQuery] = useState("")
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()

  const handleSearch = (query: string) => {
    setSearchQuery(query)
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
            <TrashTable searchQuery={searchQuery} />
          </div>
        </div>
      </div>
    </>
  )
}