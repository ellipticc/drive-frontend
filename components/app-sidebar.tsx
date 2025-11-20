"use client"

import * as React from "react"
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
import { useUser } from "@/components/user-context"

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
  },*/
  {
    title: "Shared",
    url: "/shared",
    icon: IconUsers,
  },
  /*{
    title: "Shared with me - Coming Soon",
    url: "#",
    icon: IconFolder,
  },*/
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
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()
  const { user: userData, loading: userLoading } = useUser()
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)

  // Check authentication status
  React.useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token') || document.cookie.includes('auth_token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      setIsAuthenticated(true)
    }
    checkAuth()
  }, [])

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Prepare user data for NavUser component
  const user = userData ? {
    id: userData.id,
    name: userData.name || "",
    email: userData.email,
    avatar: "",
  } : {
    id: "",
    name: "Loading...",
    email: "loading@example.com",
    avatar: "",
  }

  const data: {
    user: { id: string; name: string; email: string; avatar: string };
    navMain: typeof defaultNavMain;
    //navClouds: typeof defaultNavClouds;
    navSecondary: typeof defaultNavSecondary;
    //documents: typeof defaultDocuments;
  } = {
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
                {userLoading ? "Loading..." : (userData?.storage ? `${userData.storage.used_readable} / ${userData.storage.quota_readable}` : "0 bytes / 10GB")}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 transition-all duration-300">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: userLoading ? '0%' : (userData?.storage ? `${Math.min(userData.storage.percent_used, 100)}%` : '0%') }}
              ></div>
            </div>
            <div className="text-center mt-1 text-xs font-medium">
              {userLoading ? "Loading..." : (userData?.storage ? `${userData.storage.percent_used.toFixed(1)}% used` : "0.0% used")}
            </div>

            {/* Get more storage button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
              onClick={() => {
                // TODO: Implement storage upgrade logic
                // console.log('Get more storage clicked');
              }}
            >
              Get more storage
            </Button>
          </div>
        )}
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
})
