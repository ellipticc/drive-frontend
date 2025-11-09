"use client"

import React from 'react'
import { AppSidebar } from '@/components/layout/sidebar/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

interface AppLayoutWrapperProps {
  children: React.ReactNode
}

/**
 * Wrapper for app pages that ensures SidebarProvider is NOT recreated on route changes
 * This keeps upload modal and other global state persistent across tab navigation
 * 
 * NOTE: This is currently being used inside individual pages, but the ideal solution
 * would be to move SidebarProvider to the root layout to prevent ANY re-renders
 */
export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
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
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
