"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconDatabase,
  IconFolder,
  IconHelp,
  IconCaretLeftRightFilled,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react"

import { NavMain } from "@/components/layout/navigation/nav-main"
import { NavSecondary } from "@/components/layout/navigation/nav-secondary"
import { NavUser } from "@/components/layout/navigation/nav-user"
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
import { apiClient } from "@/lib/api"
import { useGlobalUpload } from "@/components/global-upload-context"

const defaultUser = {
  name: "Loading...",
  email: "loading@example.com",
  avatar: "/avatars/default.jpg",
  id: "",
}

const defaultNavMain = [
  {
    title: "My Files",
    url: "/",
    icon: IconFolder,
  },
  /*{
    title: "Photos & Videos - Coming Soon",
    url: "#",
    icon: IconCamera,
  }, */
  {
    title: "Shared",
    url: "/shared",
    icon: IconUsers,
  },
  /*{
    title: "Shared with me - Coming Soon",
    url: "#",
    icon: IconFolder,
  }, */
  {
    title: "Trash",
    url: "/trash",
    icon: IconTrash,
  },
]

/*const defaultNavClouds = [
  {
    title: "Capture",
    icon: IconCamera,
    isActive: true,
    url: "#",
    items: [
      {
        title: "Active Proposals",
        url: "#",
      },
      {
        title: "Archived",
        url: "#",
      },
    ],
  },
  {
    title: "Proposal",
    icon: IconFileDescription,
    url: "#",
    items: [
      {
        title: "Active Proposals",
        url: "#",
      },
      {
        title: "Archived",
        url: "#",
      },
    ],
  },
  {
    title: "Prompts",
    icon: IconFileAi,
    url: "#",
    items: [
      {
        title: "Active Proposals",
        url: "#",
      },
      {
        title: "Archived",
        url: "#",
      },
    ],
  },
] */

const defaultNavSecondary = [
  {
    title: "Settings",
    url: "#",
    icon: IconSettings,
  },
  {
    title: "Get Help",
    url: "#",
    icon: IconHelp,
  },
]

/*const defaultDocuments = [
  {
    name: "Data Library",
    url: "#",
    icon: IconDatabase,
  },
  {
    name: "Reports",
    url: "#",
    icon: IconReport,
  },
  {
    name: "Word Assistant",
    url: "#",
    icon: IconFileWord,
  },
] */

export const AppSidebar = React.memo(function AppSidebar({ 
  ...props 
}: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const router = useRouter()
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()
  const [user, setUser] = React.useState(defaultUser)
  const [loading, setLoading] = React.useState(true)
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [storage, setStorage] = React.useState({
    used_bytes: 0,
    quota_bytes: 3221225472, // 3GB default
    percent_used: 0,
    used_readable: "0 Bytes",
    quota_readable: "3 GB"
  })
  const [userFetched, setUserFetched] = React.useState(false)

  React.useEffect(() => {
    const checkAuthAndFetchUser = async () => {
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
      } catch (error) {
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

      // Only fetch user data once
      if (!userFetched) {
        try {
          const response = await apiClient.getProfile()
          if (response.success && response.data?.user) {
            const userData = response.data.user
            setUser({
              name: userData.name || "User",
              email: userData.email,
              avatar: userData.avatar || "/avatars/default.jpg",
              id: userData.id,
            })
            // Update storage data if available
            if (userData.storage) {
              setStorage(userData.storage)
            }
          }
        } catch (error) {
          // console.error("Failed to fetch user data:", error)
          // Keep default user data on error
        } finally {
          setLoading(false)
          setUserFetched(true)
        }
      }
    }

    checkAuthAndFetchUser()
  }, [userFetched]) // Only depend on userFetched to prevent re-renders

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated && !loading) {
    return null
  }

  const data = {
    user,
    navMain: defaultNavMain,
    //navClouds: defaultNavClouds,
    navSecondary: defaultNavSecondary,
    //documents: defaultDocuments,
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconCaretLeftRightFilled className="!size-5" />
                <span className="text-base font-mono break-all">ellipticc</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} />
        {/* <NavDocuments items={data.documents} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {state !== "collapsed" && (
          <div className="px-3 py-3 mx-2 mb-2 text-xs text-muted-foreground w-auto space-y-3 bg-muted/30 rounded-lg border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <IconDatabase className="!size-4 text-muted-foreground transition-colors duration-200" stroke={1.8} />
              <span className="font-semibold text-sm font-sans">Storage</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="font-medium">Used</span>
              <span className="font-mono text-xs">
                {storage.used_readable} / {storage.quota_readable}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 transition-all duration-300">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${storage.percent_used}%` }}></div>
            </div>
            <div className="text-center mt-1 text-xs font-medium">
              {storage.percent_used.toFixed(1)}% used
            </div>

            {/* Get more storage button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
              onClick={() => {
                router.push('/billing')
              }}
            >
              Get more storage
            </Button>
          </div>
        )}
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
})
