"use client"

import { IconMail, IconUpload, IconFile, IconFolder, type Icon } from "@tabler/icons-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  onFileUpload,
  onFolderUpload,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
  onFileUpload?: () => void
  onFolderUpload?: () => void
}) {
  const handleFileUpload = () => {
    onFileUpload?.()
  }

  const handleFolderUpload = () => {
    onFolderUpload?.()
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="Upload"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                >
                  <IconUpload />
                  <span>Upload</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={handleFileUpload} className="cursor-pointer">
                  <IconFile className="mr-2 h-4 w-4" />
                  Upload File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFolderUpload} className="cursor-pointer">
                  <IconFolder className="mr-2 h-4 w-4" />
                  Upload Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <a href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
