"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { SupportRequestDialog } from "@/components/support-request-dialog"
import { SettingsModal } from "@/components/modals"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.title === "Get Help" ? (
                <SupportRequestDialog>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SupportRequestDialog>
              ) : item.title === "Settings" ? (
                <SettingsModal>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SettingsModal>
              ) : (
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
