"use client"

import { useRouter } from "next/navigation"
import { IconPlus } from "@tabler/icons-react"
import { useLanguage } from "@/lib/i18n/language-context"
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar"

export function NavNew() {
    const { t } = useLanguage()
    const router = useRouter()

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip={t("common.new")}
                    onClick={() => router.push('/new')}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground transition-colors shadow-sm"
                >
                    <IconPlus className="size-4 shrink-0" />
                    <span className="font-medium">{t("common.new")}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
