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
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { IconLifebuoy, IconBooks, IconBrandDiscord, IconBrandGithub, IconSparkles } from "@tabler/icons-react"
import { useSettingsOpen } from "@/hooks/use-settings-open"

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
  const { state, isMobile } = useSidebar();
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [supportOpen, setSupportOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = useSettingsOpen()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const collapsedTooltipLabel = item.id === 'feedback' ? `${item.title} (F)` : item.title;
            return (
              <SidebarMenuItem key={item.title}>
                {item.id === "help" ? (
                  <DropdownMenu open={helpOpen} onOpenChange={setHelpOpen}>
                    {state === 'collapsed' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuButton isActive={helpOpen}>
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton isActive={helpOpen}>
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                    )}

                    <DropdownMenuContent
                      side={isMobile ? "bottom" : "right"}
                      align="start"
                      className="w-56"
                    >
                      <DropdownMenuLabel className="font-medium">{item.title}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSupportOpen(true)}>
                        <IconLifebuoy className="mr-2 h-4 w-4" />
                        Support
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="https://docs.ellipticc.com" target="_blank" rel="noreferrer">
                          <IconBooks className="mr-2 h-4 w-4" />
                          Docs
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="https://discord.gg/THSnb9mHuB" target="_blank" rel="noreferrer">
                          <IconBrandDiscord className="mr-2 h-4 w-4" />
                          Community
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="https://github.com/ellipticc/drive-frontend" target="_blank" rel="noreferrer">
                          <IconBrandGithub className="mr-2 h-4 w-4" />
                          GitHub
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>

                    <SupportRequestDialog open={supportOpen} onOpenChange={(open) => setSupportOpen(open)}>
                      <span className="hidden" />
                    </SupportRequestDialog>
                  </DropdownMenu>
                ) : item.id === "settings" ? (
                  state === 'collapsed' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          onClick={() => {
                            const tab = deviceLimitReached ? 'Security?scroll=device-manager' : 'General';
                            window.location.hash = `#settings/${tab}`;
                          }}
                          id="tour-settings"
                          isActive={settingsOpen}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton
                      onClick={() => {
                        const tab = deviceLimitReached ? 'Security?scroll=device-manager' : 'General';
                        window.location.hash = `#settings/${tab}`;
                      }}
                      id="tour-settings"
                      isActive={settingsOpen}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )
                ) : item.id === "feedback" ? (
                  state === 'collapsed' ? (
                    <FeedbackPopover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton isActive={feedbackOpen}>
                            <item.icon />
                            <span>{item.title}</span>
                            <div className="ms-auto">
                              <Kbd>F</Kbd>
                            </div>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">{collapsedTooltipLabel}</TooltipContent>
                      </Tooltip>
                    </FeedbackPopover>
                  ) : (
                    <FeedbackPopover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                      <SidebarMenuButton isActive={feedbackOpen}>
                        <item.icon />
                        <span>{item.title}</span>
                        <div className="ms-auto">
                          <Kbd>F</Kbd>
                        </div>
                      </SidebarMenuButton>
                    </FeedbackPopover>
                  )
                ) : (
                  state === 'collapsed' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <a href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton asChild>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  )
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
