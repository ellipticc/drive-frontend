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
import { FeedbackPopover } from "@/components/modals/feedback-popover"
import { Kbd } from "@/components/ui/kbd"
import { useUser } from "@/components/user-context"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
    id?: string
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { deviceLimitReached } = useUser();
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.id === "help" ? (
                <SupportRequestDialog>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SupportRequestDialog>
              ) : item.id === "settings" ? (
                <SidebarMenuButton
                  onClick={() => {
                    const tab = deviceLimitReached ? 'Security?scroll=device-manager' : 'General';
                    window.location.hash = `#settings/${tab}`;
                  }}
                  id="tour-settings"
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : item.id === "feedback" ? (
                <FeedbackPopover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                  <SidebarMenuButton isActive={feedbackOpen}>
                    <item.icon />
                    <span>{item.title}</span>
                    <div className="ms-auto">
                      <Kbd>F</Kbd>
                    </div>
                  </SidebarMenuButton>
                </FeedbackPopover>
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
