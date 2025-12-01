"use client"

import { useState } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { SharesTable } from "@/components/tables/shares-table"

export default function Shared() {
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  return (
    <>
      <SiteHeader onSearch={handleSearch} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SharesTable searchQuery={searchQuery} />
          </div>
        </div>
      </div>
    </>
  )
}