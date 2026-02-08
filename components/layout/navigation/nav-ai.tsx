"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import {
  IconBrain,
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconHistory,
} from "@tabler/icons-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function NavAI() {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const { state } = useSidebar()

  const aiItems = [
    {
      title: "New Chat",
      url: "/assistant",
      icon: IconPlus,
      id: "new-chat",
    },
    {
      title: "Chats",
      url: "/assistant",
      icon: IconMessageCircle,
      id: "chats",
    },
    {
      title: "AI Search",
      url: "/assistant/search",
      icon: IconSearch,
      id: "ai-search",
    },
    {
      title: "History",
      url: "/assistant/history",
      icon: IconHistory,
      id: "history",
    },
  ]

  const isActive = (url: string) => {
    if (url === "/assistant" && pathname === "/assistant") return true
    return pathname === url || pathname.startsWith(url + "/")
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {aiItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.url)

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  onClick={() => router.push(item.url)}
                >
                  <a href={item.url} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
