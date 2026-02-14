"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconHelpCircle,
  IconCaretLeftRightFilled,
  IconAdjustments,
  IconTrash,
  IconStack2,
  IconBubbleText,
  IconLayoutSidebar,
  IconSearch,
} from "@tabler/icons-react"

import { NavMain } from "@/components/layout/navigation/nav-main"
import { NavSecondary } from "@/components/layout/navigation/nav-secondary"
import { NavUser } from "@/components/layout/navigation/nav-user"

import { NavNew } from "@/components/layout/navigation/nav-new"
import {
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useUser } from "@/components/user-context"
import { useAICrypto } from "@/hooks/use-ai-crypto"
import { getDiceBearAvatar } from "@/lib/avatar"
import { useLanguage } from "@/lib/i18n/language-context"

const defaultUser = {
  name: "Loading...",
  email: "loading@example.com",
  avatar: getDiceBearAvatar("loading"),
  id: "",
}

export const AppSidebar = React.memo(function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const { t } = useLanguage()
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()
  const { user: contextUser, loading: userLoading } = useUser()
  const { toggleSidebar, state, isMobile } = useSidebar()
  const { chats, renameChat, pinChat, deleteChat, archiveChat } = useAICrypto();
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Keyboard shortcut for search (Cmd+K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const data = {
    user: contextUser ? {
      name: contextUser.name || "",
      email: contextUser.email,
      avatar: contextUser.avatar || getDiceBearAvatar(contextUser.id),
      id: contextUser.id,
      is_checkmarked: contextUser.is_checkmarked,
      show_checkmark: contextUser.show_checkmark,
    } : defaultUser,
    navMain: [
      {
        title: t("sidebar.myFiles"),
        url: "/vault",
        icon: IconStack2,
        id: "my-files",
      },
    ],
    navSecondary: [
      {
        title: t("sidebar.settings"),
        url: "#",
        icon: IconAdjustments,
        id: "settings",
      },
      {
        title: t("sidebar.getHelp"),
        url: "#",
        icon: IconHelpCircle,
        id: "help",
      },
      {
        title: t("sidebar.feedback"),
        url: "#",
        icon: IconBubbleText,
        id: "feedback",
      },
    ],
  }

  const [isAuthenticated, setIsAuthenticated] = React.useState(false)

  React.useEffect(() => {
    const checkAuth = async () => {
      // Check if token exists
      let token = localStorage.getItem('auth_token');

      if (!token) {
        // Try to get from cookies
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'auth_token') {
            token = decodeURIComponent(value);
            break;
          }
        }
      }

      if (!token) {
        // Redirect to login if no token
        window.location.href = '/login'
        return
      }

      // Check if token is expired
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
          // Token is expired, clear it and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('master_key');
          localStorage.removeItem('account_salt');
          localStorage.removeItem('viewMode');
          document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          window.location.href = '/login';
          return;
        }
      } catch {
        // If we can't decode the token, consider it invalid
        localStorage.removeItem('auth_token');
        localStorage.removeItem('master_key');
        localStorage.removeItem('account_salt');
        localStorage.removeItem('viewMode');
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login';
        return;
      }

      setIsAuthenticated(true)
    }

    checkAuth()
  }, [contextUser])

  // If user is loading, render a sidebar skeleton immediately so layout doesn't shift
  if (!isAuthenticated && userLoading) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="gap-2 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <div className="flex items-center gap-2">
                  <IconCaretLeftRightFilled className="size-4 shrink-0 opacity-40" />
                  <span className="text-base font-geist-mono select-none break-all leading-none opacity-40">ellipticc</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="px-3 py-3">
            <Skeleton className="h-3 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-2" />
            <Skeleton className="h-3 w-2/3 mb-2" />
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-3 py-3 mx-2 mb-2 text-xs text-muted-foreground w-auto space-y-3 bg-muted/30 rounded-lg border border-border/30">
            <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className="bg-sidebar" {...props}>
      <SidebarHeader className="gap-2 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center justify-between group-data-[collapsible=icon]:hidden">
              <SidebarMenuButton asChild className="flex-1">
                <a href="/new" className="flex items-center gap-2" onClick={(e) => { e.preventDefault(); router.push('/new'); }}>
                  <IconCaretLeftRightFilled className="size-4 shrink-0" />
                  <span className="text-base font-geist-mono select-none break-all leading-none">ellipticc</span>
                </a>
              </SidebarMenuButton>
              <SidebarTrigger className="ml-1" tooltip={{
                children: (
                  <div className="flex items-center gap-2">
                    {state === "expanded" ? "Collapse" : "Expand"}
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">⌘</span>B
                    </kbd>
                  </div>
                )
              }} />
            </div>

            <div className="hidden w-full items-center justify-center group-data-[collapsible=icon]:flex">
              <SidebarMenuButton
                className="size-7 p-0 flex items-center justify-center relative group/toggle-icon hover:bg-transparent"
                onClick={toggleSidebar}
                tooltip={{
                  children: (
                    <div className="flex items-center gap-2">
                      {t("common.toggleSidebar") || "Toggle Sidebar"}
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">⌘</span>B
                      </kbd>
                    </div>
                  )
                }}
              >
                <IconCaretLeftRightFilled className="size-4 shrink-0 transition-opacity group-hover/toggle-icon:opacity-0" />
                <IconLayoutSidebar className="size-4 shrink-0 absolute inset-0 m-auto opacity-0 transition-opacity group-hover/toggle-icon:opacity-100" />
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="mt-3 mb-1">
          <NavNew />
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setSearchOpen(true)}
              tooltip="Search Chats (Ctrl+K)"
              className="relative group/menu-button"
            >
              <IconSearch className="size-4 shrink-0" />
              <span>Search</span>
              <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-0 group-hover/menu-button:opacity-60 transition-opacity group-data-[collapsible=icon]:hidden sm:flex">
                <span className="text-[10px]">Ctrl</span>K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <CommandDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          className="max-w-7xl"
          commandClassName="**:data-[slot=command-input-wrapper]:justify-center [&_[cmdk-input]]:mx-auto [&_[cmdk-input]]:max-w-4xl **:data-[slot=command-input-wrapper]:px-6 [&_[cmdk-item]]:py-1.5"
        >
          <CommandInput placeholder="Search chats..." />
          <CommandList className="max-h-[500px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Recent Chats">
              {chats.map(chat => (
                <CommandItem
                  key={chat.id}
                  onSelect={() => {
                    router.push(`/new?conversationId=${chat.id}`);
                    setSearchOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <IconBubbleText className="mr-2 h-4 w-4" />
                  <span>{chat.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </SidebarHeader>
      <SidebarContent>
        <>
          <NavMain items={data.navMain} />
          {/* spaces placeholder */}
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
})
