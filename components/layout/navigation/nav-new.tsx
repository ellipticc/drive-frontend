"use client"

import { useRouter } from "next/navigation"
import { IconPlus } from "@tabler/icons-react"
import {
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Kbd } from "@/components/ui/kbd"

export function NavNew() {
    const router = useRouter()

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                tooltip="New Chat (Ctrl+Shift+O)"
                onClick={() => router.push('/new')}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground transition-colors shadow-sm group/nav-item"
            >
                <IconPlus className="size-4 shrink-0" />
                <span className="font-medium">New Chat</span>
                <Kbd className="ms-auto h-5 select-none items-center gap-1 rounded border border-primary-foreground/30 bg-primary-foreground/20 px-1.5 font-mono text-[10px] font-medium text-primary opacity-0 group-hover/nav-item:opacity-100 transition-opacity sm:inline-flex">
                    <span className="text-[9px]">⌘⇧</span>O
                </Kbd>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}
