"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconDatabase,
  IconHelpCircle,
  IconCaretLeftRightFilled,
  IconAdjustments,
  IconTrash,
  IconLink,
  IconDatabaseImport,
  IconPhoto,
  IconStack2,
  IconBubbleText,
  IconChartAreaLine,
  IconUsers,
  IconSignature,
  IconClockHour9,
  IconStar,
  IconWritingSign,
  IconBrain,
} from "@tabler/icons-react"

import { NavMain } from "@/components/layout/navigation/nav-main"
import { NavAI } from "@/components/layout/navigation/nav-ai"
import { NavSecondary } from "@/components/layout/navigation/nav-secondary"
import { NavUser } from "@/components/layout/navigation/nav-user"
import { NavSpaces } from "@/components/layout/navigation/nav-spaces"
import { NavNew } from "@/components/layout/navigation/nav-new"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useUser } from "@/components/user-context"
import { useAIMode } from "@/components/ai-mode-context"
import { getDiceBearAvatar } from "@/lib/avatar"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { apiClient } from "@/lib/api"

const defaultUser = {
  name: "Loading...",
  email: "loading@example.com",
  avatar: getDiceBearAvatar("loading"),
  id: "",
}

export const AppSidebar = React.memo(function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const router = useRouter()
  const { t } = useLanguage()
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()
  const { user: contextUser, loading: userLoading } = useUser()
  const { isAIMode, setIsAIMode, isHydrated } = useAIMode()
  const [pendingCount, setPendingCount] = React.useState(0)

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
        url: "/",
        icon: IconStack2,
        id: "my-files",
      },
      {
        title: t("sidebar.recents") || "Recents",
        url: "/recents",
        icon: IconClockHour9,
        id: "recents",
      },
      {
        title: t("sidebar.starred") || "Starred",
        url: "/starred",
        icon: IconStar,
        id: "starred",
      },
      {
        title: "Assistant",
        url: "/assistant",
        icon: IconBrain,
        id: "assistant",
      },
      {
        title: t("sidebar.photos"),
        url: "/photos",
        icon: IconPhoto,
        id: "photos",
      },
      {
        title: "Insights",
        url: "/insights",
        icon: IconChartAreaLine,
        id: "insights",
      },
      {
        title: t("sidebar.shared"),
        url: "/shared",
        icon: IconLink,
        id: "shared",
      },
      {
        title: t("sidebar.sharedWithMe"),
        url: "/shared-with-me",
        icon: IconUsers,
        id: "shared-with-me",
        badge: pendingCount > 0 ? pendingCount : undefined, // Display badge if count > 0
      },
      // Attestations tab hidden for now
      /*
      {
        title: "Attestations",
        url: "/attestations",
        icon: IconSignature,
        id: "attestations",
        items: [
          {
            title: "Sign Document",
            url: "/attestations#Sign",
            icon: IconWritingSign,
          },
          {
            title: "Documents",
            url: "/attestations#Documents",
            icon: IconStack2,
          },
          {
            title: "Manage Keys",
            url: "/attestations#Keys",
            icon: IconDatabase,
          },
          {
            title: "Audit Logs",
            url: "/attestations#Logs",
            icon: IconChartAreaLine,
          },
        ]
      },
      */
      {
        title: t("sidebar.trash"),
        url: "/trash",
        icon: IconTrash,
        id: "trash",
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
  // pendingCount state moved up
  const [storage, setStorage] = React.useState({
    used_bytes: 0,
    quota_bytes: 2147483648, // 2GB default
    percent_used: 0,
    used_readable: "0 Bytes",
    quota_readable: "2 GB"
  })

  React.useEffect(() => {
    const checkAuth = async () => {
      // Check if token exists
      let token = localStorage.getItem('auth_token');

      // Fetch pending share count if authenticated
      try {
        const response = await apiClient.getPendingSharedCount();
        if (response.success && response.data) {
          setPendingCount(Number(response.data.count));
        }
      } catch (err) {
        console.error("Failed to fetch pending share count", err);
      }

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

      // Update storage if available from context user
      if (contextUser?.storage) {
        setStorage(contextUser.storage)
      }
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
            <SidebarMenuButton
              asChild
            >
              <a href="/" className="flex items-center gap-2" onClick={(e) => { e.preventDefault(); router.push('/'); }}>
                <IconCaretLeftRightFilled className="size-4 shrink-0" />
                <span className="text-base font-geist-mono select-none break-all leading-none">ellipticc</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Show AI Native switch only on Assistant routes */}
        {(() => {
          const pathnameLocal = usePathname();
          const onAssistant = typeof pathnameLocal === 'string' && pathnameLocal.startsWith('/assistant');
          return onAssistant ? (
            <div className="flex items-center justify-between px-2 py-2 rounded-md bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 flex-1">
                <IconBrain className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground flex-1">AI Native</span>
              </div>
              <Switch
                checked={isAIMode}
                onCheckedChange={(v) => setIsAIMode(Boolean(v))}
                aria-label="Toggle AI Native Mode"
                className="data-[state=checked]:bg-primary"
              />
            </div>
          ) : (
            <NavNew onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} />
          )
        })()}
      </SidebarHeader>
      <SidebarContent>
        {isAIMode ? (
          <>
            <NavAI />
            <NavSecondary items={data.navSecondary} className="mt-auto" />
          </>
        ) : (
          <>
            <NavMain items={data.navMain} />
            <NavSpaces />
            <NavSecondary items={data.navSecondary} className="mt-auto" />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        {!isAIMode && state !== "collapsed" && (
          <div className="px-3 py-3 mx-2 mb-2 text-xs text-muted-foreground w-auto space-y-3 bg-muted/30 rounded-lg border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <IconDatabase className="!size-4 text-muted-foreground transition-colors duration-200" stroke={1.8} />
              <span className="font-semibold text-sm font-sans">{t("sidebar.storage")}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="font-medium">{t("sidebar.used")}</span>
              <span className="font-mono text-xs">
                {storage.used_readable} / {storage.quota_readable}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 transition-all duration-300">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${storage.percent_used}%` }}></div>
            </div>
            <div className="text-center mt-1 text-xs font-medium">
              {storage.percent_used.toFixed(1)}% {t("sidebar.used").toLowerCase()}
            </div>

            {/* Get more storage button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground duration-200 ease-linear dark:bg-white dark:text-black dark:hover:bg-gray-200"
              onClick={() => {
                router.push('/pricing')
              }}
            >
              <IconDatabaseImport className="size-4" />
              {t("sidebar.getMore")}
            </Button>
          </div>
        )}
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
})
