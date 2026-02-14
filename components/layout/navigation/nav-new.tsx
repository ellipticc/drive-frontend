"use client"

import { useRouter } from "next/navigation"
import { IconPlus } from "@tabler/icons-react"
import {
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar"

export function NavNew() {
    const router = useRouter()

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                tooltip="New Chat"
                onClick={() => router.push('/new')}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground transition-colors shadow-sm"
            >
                <IconPlus className="size-4 shrink-0" />
                <span className="font-medium">New Chat</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}
