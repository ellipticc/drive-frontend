"use client"

import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/files-table"
import { useGlobalUpload } from "@/components/global-upload-context"

export default function SharedWithMe() {
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()

  return (
    <>
      <SiteHeader 
        onFileUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Table01DividerLineSm />
          </div>
        </div>
      </div>
    </>
  )
}