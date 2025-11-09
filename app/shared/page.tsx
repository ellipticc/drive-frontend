"use client"

import { SiteHeader } from "@/components/layout/header/site-header"
import { SharesTable } from "@/components/tables/shares-table"

export default function Shared() {
  return (
    <>
      <SiteHeader pageTitle="Shared" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SharesTable />
          </div>
        </div>
      </div>
    </>
  )
}