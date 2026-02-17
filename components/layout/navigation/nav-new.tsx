"use client"

import { useRouter } from "next/navigation"
import { IconPlus } from "@tabler/icons-react"
import {
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"

export function NavNew() {
    const router = useRouter()
    const { state } = useSidebar()

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                tooltip={{
                    children: (
                        <div className="flex items-center gap-1">
                            New Chat
                            <Kbd>
                                <span className="text-[9px]">⌘⇧</span>O
                            </Kbd>
                        </div>
                    ),
                    side: "right",
                    hidden: state !== "collapsed"
                }}
                onClick={() => router.push('/new')}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground transition-colors shadow-sm group/nav-item justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            >
                <IconPlus className="size-4 shrink-0" />
                <span className="font-medium group-data-[collapsible=icon]:hidden">
                    New Chat
                </span>
                <Kbd className="ms-auto h-5 select-none items-center gap-1 rounded border border-primary-foreground/30 bg-primary-foreground/20 px-1.5 font-mono text-[10px] font-medium text-primary opacity-0 group-hover/nav-item:opacity-100 transition-opacity hidden sm:inline-flex group-data-[collapsible=icon]:hidden">
                    <span className="text-[9px]">⌘⇧</span>O
                </Kbd>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}
