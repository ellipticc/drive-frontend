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
import { FeedbackModal } from "@/components/modals/feedback-modal"
import { Kbd } from "@/components/ui/kbd"

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
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  return (
    <SidebarGroup {...props}>
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
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
                <SidebarMenuButton onClick={() => window.location.hash = '#settings/General'} id="tour-settings">
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : item.title === "Feedback" ? (
                <SidebarMenuButton onClick={() => setFeedbackOpen(true)}>
                  <item.icon />
                  <span>{item.title}</span>
                  <div className="ml-auto">
                    <Kbd>F</Kbd>
                  </div>
                </SidebarMenuButton>
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
