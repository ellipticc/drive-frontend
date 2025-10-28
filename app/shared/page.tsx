"use client"

import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { SectionCards } from "@/components/shared/section-cards"
import { SiteHeader } from "@/components/layout/header/site-header"
import { SharesTable } from "@/components/tables/shares-table"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useEffect, useState } from "react"
import { IconLoader2 } from "@tabler/icons-react"

export default function Shared() {
  const [isTableLoading, setIsTableLoading] = useState(true)

  useEffect(() => {
    document.title = "Shared - Ellipticc Drive"
    // Simulate loading time for table data
    const timer = setTimeout(() => setIsTableLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader pageTitle="Shared" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              {isTableLoading ? (
                <div className="flex items-center justify-center py-8">
                  <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <SharesTable />
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}