"use client"

import { SiteHeader } from "@/components/layout/header/site-header"
import { TrashTable } from "@/components/tables/trash-table"

export default function Trash() {
  return (
    <>
      <SiteHeader pageTitle="Trash" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <TrashTable />
          </div>
        </div>
      </div>
    </>
  )
}