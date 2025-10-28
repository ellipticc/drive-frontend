"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { SectionCards } from "@/components/shared/section-cards"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Table01DividerLineSm } from "@/components/tables/team-members-table"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    document.title = "My Files - Ellipticc Drive"
  }, [])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
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
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader pageTitle="My Files" onSearch={handleSearch} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <Table01DividerLineSm searchQuery={searchQuery} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}