"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { SupportRequestDialog } from "@/components/support-request-dialog"
import { FeedbackPopover } from "@/components/modals/feedback-popover"
import { FeedbackDialog } from "@/components/modals/feedback-dialog"
import { Kbd } from "@/components/ui/kbd"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { IconLifebuoy, IconBooks, IconBrandDiscord, IconBrandGithub, IconSparkles, IconAdjustmentsFilled, IconHelpCircleFilled, IconBubbleTextFilled } from "@tabler/icons-react"
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
    shortcut?: string
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { state, isMobile } = useSidebar();
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [supportOpen, setSupportOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = useSettingsOpen()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ignore input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === "h") {
          e.preventDefault();
          setHelpOpen((open) => !open);
        }
        if (e.key === "f") {
          e.preventDefault();
          setFeedbackOpen((open) => !open);
        }
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Helper function to get filled icon for active states
  const getIcon = (item: { icon: Icon; id?: string }, isActive: boolean) => {
    if (!isActive) return item.icon

    switch (item.id) {
      case 'settings':
        return IconAdjustmentsFilled
      case 'help':
        return IconHelpCircleFilled
      case 'feedback':
        return IconBubbleTextFilled
      default:
        return item.icon
    }
  }

  return (
    <SidebarGroup {...props} className={cn("p-0", state === 'collapsed' ? 'sticky bottom-0' : '', props.className)}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            return (
              <SidebarMenuItem key={item.title}>
                {item.id === "help" ? (
                  <DropdownMenu open={helpOpen} onOpenChange={setHelpOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton isActive={helpOpen} className="pr-8 group/nav group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
                            {(() => {
                              const IconComponent = getIcon(item, helpOpen)
                              return <IconComponent className="size-4" />
                            })()}
                            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                            <div className="ms-auto opacity-0 group-hover/nav:opacity-60 transition-opacity group-data-[collapsible=icon]:hidden">
                              <Kbd>H</Kbd>
                            </div>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right" hidden={state !== 'collapsed' || isMobile}>
                        <div className="flex items-center gap-1">
                          {item.title}
                          {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                        </div>
                      </TooltipContent>
                    </Tooltip>

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
                  <SidebarMenuButton
                    onClick={() => {
                      const tab = 'General';
                      window.location.hash = `#settings/${tab}`;
                    }}
                    isActive={settingsOpen}
                    tooltip={{
                      children: (
                        <div className="flex items-center gap-1">
                          {item.title}
                          {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                        </div>
                      ),
                      side: "right",
                      hidden: state !== "collapsed"
                    }}
                    className="pr-8 group/nav group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                  >
                    {(() => {
                      const IconComponent = getIcon(item, settingsOpen)
                      return <IconComponent className="size-4 shrink-0" />
                    })()}
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    {item.shortcut && (
                      <div className="ms-auto opacity-0 group-hover/nav:opacity-60 transition-opacity group-data-[collapsible=icon]:hidden">
                        <Kbd>{item.shortcut}</Kbd>
                      </div>
                    )}
                  </SidebarMenuButton>
                ) : item.id === "feedback" ? (
                  // Use Dialog on mobile, Popover on desktop
                  isMobile ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={feedbackOpen}
                            onClick={() => setFeedbackOpen(true)}
                            className="pr-8 group/nav group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                          >
                            {(() => {
                              const IconComponent = getIcon(item, feedbackOpen)
                              return <IconComponent className="size-4 shrink-0" />
                            })()}
                            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                            <div className="ms-auto opacity-0 group-hover/nav:opacity-60 transition-opacity group-data-[collapsible=icon]:hidden">
                              <Kbd>F</Kbd>
                            </div>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" hidden={state !== 'collapsed' || isMobile}>
                          <div className="flex items-center gap-1">
                            {item.title}
                            {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
                    </>
                  ) : (
                    <Tooltip>
                      <FeedbackPopover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={feedbackOpen}
                            className="pr-8 group/nav group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                          >
                            {(() => {
                              const IconComponent = getIcon(item, feedbackOpen)
                              return <IconComponent className="size-4 shrink-0" />
                            })()}
                            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                            <div className="ms-auto opacity-0 group-hover/nav:opacity-60 transition-opacity group-data-[collapsible=icon]:hidden">
                              <Kbd>F</Kbd>
                            </div>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                      </FeedbackPopover>
                      <TooltipContent side="right" hidden={state !== 'collapsed' || isMobile}>
                        <div className="flex items-center gap-1">
                          {item.title}
                          {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                ) : (
                  <SidebarMenuButton
                    asChild
                    tooltip={{
                      children: item.title,
                      side: "right",
                      hidden: state !== "collapsed"
                    }}
                    className="pr-8 group/nav group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                  >
                    <a href={item.url}>
                      <item.icon className="size-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup >
  )
}
