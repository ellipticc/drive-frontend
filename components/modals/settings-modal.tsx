"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from "sonner"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  IconSettings,
  IconLoader2,
  IconPencil,
  IconMail,
  IconLock,
  IconLogout,
  IconTrash,
  IconUserCog,
  IconLockSquareRounded,
  IconGift,
  IconCopy,
  IconCheck as IconCheckmark,
  IconBell,
  IconCoin,
  IconInfoCircle,
  IconRefresh,
  IconX,
  IconShieldLock,
  IconChevronLeft,
  IconChevronRight,
  IconActivity,
  IconDownload,
  IconShield as Shield,
  IconUserShield as ShieldUser,
  IconWorld
} from "@tabler/icons-react"
import { apiClient, Referral, Subscription, BillingUsage, PricingPlan, SubscriptionHistory, SecurityEvent } from "@/lib/api"
import { useTheme } from "next-themes"
import { getDiceBearAvatar } from "@/lib/avatar"
import { useUser } from "@/components/user-context"
import { getInitials } from "@/components/layout/navigation/nav-user"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { compressAvatar } from "@/lib/image"

interface SettingsModalProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialTab?: string
}

const data = {
  nav: [
    { name: "General", icon: IconUserCog, id: "general" },
    { name: "Security", icon: IconLockSquareRounded, id: "security" },
    { name: "Billing", icon: IconCoin, id: "billing" },
    { name: "Notifications", icon: IconBell, id: "notifications" },
    { name: "Referrals", icon: IconGift, id: "referrals" },
  ],
}

// Colored SVG Components for OS and Browsers
const WindowsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.1 6L3.5 8.5V23.5H22.1V6Z" fill="#00ADEF" />
    <path d="M44.5 3L24.1 5.8V23.5H44.5V3Z" fill="#00ADEF" />
    <path d="M22.1 24.5H3.5V39.5L22.1 42V24.5Z" fill="#00ADEF" />
    <path d="M44.5 24.5H24.1V42.2L44.5 45V24.5Z" fill="#00ADEF" />
  </svg>
)

const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41-73-41-35.7 0-61.1 24.8-77.1 24.8-16.1 0-42.3-24.8-74-24.8-40.2 0-82.6 28.5-101.4 69.3-39.7 101.4-1.2 216 35.7 216 16.9 0 41.5-24.2 65.8-24.2 24.3 0 43.1 24.2 65.8 24.2 3.8 0 8.3-2.3 12.3-3.6 42.1-13.4 75-53.7 75-103.1l-.1-3.6zM288.6 112.9c16.3-21 21.6-47.3 18.6-72.9-20.9 1.1-46.1 14.1-60.3 31.9-13.1 16.2-18.1 40-15.1 64.6 19.3 1.5 40.5-14.6 56.8-23.6z" />
  </svg>
)

const AndroidIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M36.1 15.6C36.1 15.6 36.1 15.6 36.1 15.6C36.1 15.6 36.1 15.6 36.1 15.6Z" fill="#3DDC84" />
    <path d="M36.1 15.6C34.7 15.6 33.4 16.1 32.4 17L31 15.6C30 14.7 28.7 14.2 27.2 14.2C25.8 14.2 24.5 14.7 23.5 15.6L22.1 17C21.1 16.1 19.8 15.6 18.4 15.6C17 15.6 15.7 16.1 14.7 17L13.3 15.6C12.3 14.7 11 14.2 9.5 14.2C8.1 14.2 6.8 14.7 5.8 15.6L4.4 17C3.4 16.1 2.1 15.6 0.7 15.6V42.2C0.7 43.8 2 45.1 3.6 45.1H40.9C42.5 45.1 43.8 43.8 43.8 42.2V15.6C42.3 15.6 41 16.1 40 17L38.6 15.6C37.6 14.7 36.3 14.2 34.9 14.2L36.1 15.6ZM13.8 33.3C12.4 33.3 11.2 32.1 11.2 30.7C11.2 29.3 12.4 28.1 13.8 28.1C15.2 28.1 16.4 29.3 16.4 30.7C16.4 32.1 15.2 33.3 13.8 33.3ZM30.7 33.3C29.3 33.3 28.1 32.1 28.1 30.7C28.1 29.3 29.3 28.1 30.7 28.1C32.1 28.1 33.3 29.3 33.3 30.7C33.3 32.1 32.1 33.3 30.7 33.3Z" fill="#3DDC84" />
    <path d="M8.2 10.7L5.3 5.4C5 4.9 5.2 4.3 5.7 4.1C6.2 3.8 6.8 4 7.1 4.5L10 9.8C11.5 9.1 13.2 8.7 15 8.7C16.8 8.7 18.5 9.1 20 9.8L22.9 4.5C23.2 4 23.8 3.8 24.3 4.1C24.8 4.3 25 4.9 24.7 5.4L21.8 10.7C24.4 12.1 26.5 14.3 27.9 17H2.1C3.5 14.3 5.6 12.1 8.2 10.7Z" fill="#3DDC84" />
  </svg>
)

const UbuntuIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="#E95420" />
    <path d="M24 33C28.9706 33 33 28.9706 33 24C33 19.0294 28.9706 15 24 15C19.0294 15 15 19.0294 15 24C15 28.9706 19.0294 33 24 33Z" fill="white" />
    <path d="M24 30C27.3137 30 30 27.3137 30 24C30 20.6863 27.3137 18 24 18C20.6863 18 18 20.6863 18 24C18 27.3137 20.6863 30 24 30Z" fill="#E95420" />
  </svg>
)

const ChromeIcon = ({ className }: { className?: string }) => (
  <svg className={className} version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" xmlSpace="preserve">
    <path fill="#FFFFFF" d="M255.73,383.71c70.3,0,127.3-56.99,127.3-127.3s-56.99-127.3-127.3-127.3s-127.3,56.99-127.3,127.3
	S185.42,383.71,255.73,383.71z"/>
    <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="283.2852" y1="18.9008" x2="62.8264" y2="400.7473" gradientTransform="matrix(1 0 0 -1 0 514)">
      <stop offset="0" style={{ stopColor: '#1E8E3E' }} />
      <stop offset="1" style={{ stopColor: '#34A853' }} />
    </linearGradient>
    <path fill="url(#SVGID_1_)" d="M145.48,320.08L35.26,129.17c-22.35,38.7-34.12,82.6-34.12,127.29s11.76,88.59,34.11,127.29
	c22.35,38.7,54.49,70.83,93.2,93.17c38.71,22.34,82.61,34.09,127.3,34.08l110.22-190.92v-0.03c-11.16,19.36-27.23,35.44-46.58,46.62
	c-19.35,11.18-41.3,17.07-63.65,17.07s-44.3-5.88-63.66-17.05C172.72,355.52,156.65,339.44,145.48,320.08z"/>
    <linearGradient id="SVGID_2_" gradientUnits="userSpaceOnUse" x1="218.5901" y1="2.3333" x2="439.0491" y2="384.1796" gradientTransform="matrix(1 0 0 -1 0 514)">
      <stop offset="0" style={{ stopColor: '#FCC934' }} />
      <stop offset="1" style={{ stopColor: '#FBBC04' }} />
    </linearGradient>
    <path fill="url(#SVGID_2_)" d="M365.96,320.08L255.74,510.99c44.69,0.01,88.59-11.75,127.29-34.1
	c38.7-22.34,70.84-54.48,93.18-93.18c22.34-38.7,34.1-82.61,34.09-127.3c-0.01-44.69-11.78-88.59-34.14-127.28H255.72l-0.03,0.02
	c22.35-0.01,44.31,5.86,63.66,17.03c19.36,11.17,35.43,27.24,46.61,46.59c11.18,19.35,17.06,41.31,17.06,63.66
	C383.03,278.77,377.14,300.72,365.96,320.08L365.96,320.08z"/>
    <path fill="#1A73E8" d="M255.73,357.21c55.66,0,100.78-45.12,100.78-100.78s-45.12-100.78-100.78-100.78
	s-100.78,45.12-100.78,100.78S200.07,357.21,255.73,357.21z"/>
    <linearGradient id="SVGID_3_" gradientUnits="userSpaceOnUse" x1="35.2587" y1="353.0303" x2="476.177" y2="353.0303" gradientTransform="matrix(1 0 0 -1 0 514)">
      <stop offset="0" style={{ stopColor: '#D93025' }} />
      <stop offset="1" style={{ stopColor: '#EA4335' }} />
    </linearGradient>
    <path fill="url(#SVGID_3_)" d="M255.73,129.14h220.45C453.84,90.43,421.7,58.29,383,35.95C344.3,13.6,300.4,1.84,255.71,1.84
	c-44.69,0-88.59,11.77-127.29,34.12c-38.7,22.35-70.83,54.5-93.16,93.2l110.22,190.92l0.03,0.02
	c-11.18-19.35-17.08-41.3-17.08-63.65s5.87-44.31,17.04-63.66c11.17-19.36,27.24-35.43,46.6-46.6
	C211.42,135.01,233.38,129.13,255.73,129.14z"/>
  </svg>
)

const FirefoxIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.419 81.967">
    <defs>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="80.797" cy="-8515.121" cx="-7907.187" id="b"><stop stopColor="#ffbd4f" offset=".129" /><stop stopColor="#ffac31" offset=".186" /><stop stopColor="#ff9d17" offset=".247" /><stop stopColor="#ff980e" offset=".283" /><stop stopColor="#ff563b" offset=".403" /><stop stopColor="#ff3750" offset=".467" /><stop stopColor="#f5156c" offset=".71" /><stop stopColor="#eb0878" offset=".782" /><stop stopColor="#e50080" offset=".86" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="80.797" cy="-8482.089" cx="-7936.711" id="c"><stop stopColor="#960e18" offset=".3" /><stop stopOpacity=".74" stopColor="#b11927" offset=".351" /><stop stopOpacity=".343" stopColor="#db293d" offset=".435" /><stop stopOpacity=".094" stopColor="#f5334b" offset=".497" /><stop stopOpacity="0" stopColor="#ff3750" offset=".53" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="58.534" cy="-8533.457" cx="-7926.97" id="d"><stop stopColor="#fff44f" offset=".132" /><stop stopColor="#ffdc3e" offset=".252" /><stop stopColor="#ff9d12" offset=".506" /><stop stopColor="#ff980e" offset=".526" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="38.471" cy="-8460.984" cx="-7945.648" id="e"><stop stopColor="#3a8ee6" offset=".353" /><stop stopColor="#5c79f0" offset=".472" /><stop stopColor="#9059ff" offset=".669" /><stop stopColor="#c139e6" offset="1" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="matrix(.972 -.235 .275 1.138 10095.002 7833.794)" r="20.397" cy="-8491.546" cx="-7935.62" id="f"><stop stopOpacity="0" stopColor="#9059ff" offset=".206" /><stop stopOpacity=".064" stopColor="#8c4ff3" offset=".278" /><stop stopOpacity=".45" stopColor="#7716a8" offset=".747" /><stop stopOpacity=".6" stopColor="#6e008b" offset=".975" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="27.676" cy="-8518.427" cx="-7937.731" id="g"><stop stopColor="#ffe226" offset="0" /><stop stopColor="#ffdb27" offset=".121" /><stop stopColor="#ffc82a" offset=".295" /><stop stopColor="#ffa930" offset=".502" /><stop stopColor="#ff7e37" offset=".732" /><stop stopColor="#ff7139" offset=".792" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="118.081" cy="-8535.981" cx="-7915.977" id="h"><stop stopColor="#fff44f" offset=".113" /><stop stopColor="#ff980e" offset=".456" /><stop stopColor="#ff5634" offset=".622" /><stop stopColor="#ff3647" offset=".716" /><stop stopColor="#e31587" offset=".904" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="matrix(.105 .995 -.653 .069 -4680.304 8470.187)" r="86.499" cy="-8522.859" cx="-7927.165" id="i"><stop stopColor="#fff44f" offset="0" /><stop stopColor="#ffe847" offset=".06" /><stop stopColor="#ffc830" offset=".168" /><stop stopColor="#ff980e" offset=".304" /><stop stopColor="#ff8b16" offset=".356" /><stop stopColor="#ff672a" offset=".455" /><stop stopColor="#ff3647" offset=".57" /><stop stopColor="#e31587" offset=".737" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="73.72" cy="-8508.176" cx="-7938.383" id="j"><stop stopColor="#fff44f" offset=".137" /><stop stopColor="#ff980e" offset=".48" /><stop stopColor="#ff5634" offset=".592" /><stop stopColor="#ff3647" offset=".655" /><stop stopColor="#e31587" offset=".904" /></radialGradient>
      <radialGradient gradientUnits="userSpaceOnUse" gradientTransform="translate(7978.7 8523.996)" r="80.686" cy="-8503.861" cx="-7918.923" id="k"><stop stopColor="#fff44f" offset=".094" /><stop stopColor="#ffe141" offset=".231" /><stop stopColor="#ffaf1e" offset=".509" /><stop stopColor="#ff980e" offset=".626" /></radialGradient>
      <linearGradient gradientTransform="translate(3.7 -.004)" gradientUnits="userSpaceOnUse" y2="74.468" x2="6.447" y1="12.393" x1="70.786" id="a"><stop stopColor="#fff44f" offset=".048" /><stop stopColor="#ffe847" offset=".111" /><stop stopColor="#ffc830" offset=".225" /><stop stopColor="#ff980e" offset=".368" /><stop stopColor="#ff8b16" offset=".401" /><stop stopColor="#ff672a" offset=".462" /><stop stopColor="#ff3647" offset=".534" /><stop stopColor="#e31587" offset=".705" /></linearGradient>
      <linearGradient gradientTransform="translate(3.7 -.004)" gradientUnits="userSpaceOnUse" y2="66.806" x2="15.267" y1="12.061" x1="70.013" id="l"><stop stopOpacity=".8" stopColor="#fff44f" offset=".167" /><stop stopOpacity=".634" stopColor="#fff44f" offset=".266" /><stop stopOpacity=".217" stopColor="#fff44f" offset=".489" /><stop stopOpacity="0" stopColor="#fff44f" offset=".6" /></linearGradient>
    </defs>
    <path d="M79.616 26.827c-1.684-4.052-5.1-8.427-7.775-9.81a40.266 40.266 0 013.925 11.764l.007.065C71.391 17.92 63.96 13.516 57.891 3.924a47.099 47.099 0 01-.913-1.484 12.24 12.24 0 01-.427-.8 7.053 7.053 0 01-.578-1.535.1.1 0 00-.088-.1.138.138 0 00-.073 0c-.005 0-.013.009-.019.01l-.028.016.015-.026c-9.735 5.7-13.038 16.252-13.342 21.53a19.387 19.387 0 00-10.666 4.11 11.587 11.587 0 00-1-.757 17.968 17.968 0 01-.109-9.473 28.705 28.705 0 00-9.329 7.21h-.018c-1.536-1.947-1.428-8.367-1.34-9.708a6.928 6.928 0 00-1.294.687 28.225 28.225 0 00-3.788 3.245 33.845 33.845 0 00-3.623 4.347v.006-.007a32.733 32.733 0 00-5.2 11.743l-.052.256a61.89 61.89 0 00-.381 2.42c0 .029-.006.056-.009.085A36.937 36.937 0 005 41.042v.2a38.759 38.759 0 0076.954 6.554c.065-.5.118-.995.176-1.5a39.857 39.857 0 00-2.514-19.47zm-44.67 30.338c.181.087.351.18.537.264l.027.017q-.282-.135-.564-.281zm8.878-23.376zm31.952-4.934v-.037l.007.04z" fill="url(#a)" />
  </svg>
)

const SafariIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" viewBox="0 0 256 256">
    <defs>
      <linearGradient x1="50%" y1="100%" x2="50%" y2="0%" id="a"><stop stopColor="#DBDBDA" offset="25%" /><stop stopColor="#FFF" offset="100%" /></linearGradient>
      <linearGradient x1="49.05%" y1="35.703%" x2="25.713%" y2="77.572%" id="d"><stop stopOpacity="0" offset="0%" /><stop offset="100%" /></linearGradient>
      <filter x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox" id="b"><feOffset dy="2" in="SourceAlpha" result="shadowOffsetOuter1" /><feGaussianBlur stdDeviation="2" in="shadowOffsetOuter1" result="shadowBlurOuter1" /><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.266007133 0" in="shadowBlurOuter1" result="shadowMatrixOuter1" /><feMerge><feMergeNode in="shadowMatrixOuter1" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox" id="e"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1" /><feGaussianBlur stdDeviation="2" in="shadowOffsetOuter1" result="shadowBlurOuter1" /><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 13 0" in="shadowBlurOuter1" result="shadowMatrixOuter1" /><feMerge><feMergeNode in="shadowMatrixOuter1" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <radialGradient cx="57.025%" cy="39.017%" fx="57.025%" fy="39.017%" r="61.032%" id="c"><stop stopColor="#2ABCE1" offset="0%" /><stop stopColor="#2ABBE1" offset="11.363%" /><stop stopColor="#3375F8" offset="100%" /></radialGradient>
    </defs>
    <g transform="translate(4 2)"><circle fill="url(#a)" filter="url(#b)" cx="124" cy="124" r="124" /><circle fill="url(#c)" cx="124" cy="124" r="114.7" /> </g>
  </svg>
)

const EdgeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M38.8 24.1C38.8 15.9 32.2 9.2 24 9.2C15.8 9.2 9.2 15.8 9.2 24C9.2 32.2 15.8 38.8 24 38.8C32.2 38.8 38.8 32.1 38.8 24.1Z" fill="white" />
    <path d="M24 4C13 4 4 13 4 24C4 35 13 44 24 44C32.6 44 39.9 38.5 42.6 30.9C42.8 30.2 42.4 29.5 41.7 29.3C41 29.1 40.3 29.5 40.1 30.2C38 36.6 31.9 41.2 24.7 41.2C15.3 41.2 7.7 33.6 7.7 24.2C7.7 14.8 15.3 7.2 24.7 7.2C32.4 7.2 38.9 12.3 40.8 19.3C41 20 41.7 20.4 42.4 20.2C43.1 20 43.5 19.3 43.3 18.6C41 10.2 33.2 4.1 24.1 4.1L24 4Z" fill="#0078D4" />
    <path d="M42.4 20.2C39.4 20.2 37 22.6 37 25.6V26.6C37 32.8 32 37.8 25.8 37.8C19.6 37.8 14.6 32.8 14.6 26.6V25.6C14.6 22.6 12.2 20.2 9.2 20.2H42.4Z" fill="#0078D4" />
  </svg>
)

const OperaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="#FF1B2D" />
    <path d="M24 37C28.4183 37 32 31.1797 32 24C32 16.8203 28.4183 11 24 11C19.5817 11 16 16.8203 16 24C16 31.1797 19.5817 37 24 37Z" fill="white" />
    <path d="M24 34C26.2091 34 28 29.5228 28 24C28 18.4772 26.2091 14 24 14C21.7909 14 20 18.4772 20 24C20 29.5228 21.7909 34 24 34Z" fill="#FF1B2D" />
  </svg>
)

export function SettingsModal({
  children,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialTab,
}: SettingsModalProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false)
  const { user, refetch, deviceLimitReached } = useUser()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { registerOnUploadComplete, unregisterOnUploadComplete } = useGlobalUpload()

  // Use external state if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen

  // Handle tab changes and update URL
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    // Update URL hash
    const tabPath = tabId.charAt(0).toUpperCase() + tabId.slice(1)
    window.history.replaceState(null, '', `#settings/${tabPath}`)
  }

  // Handle modal open/close
  const handleOpenChange = (newOpen: boolean) => {
    // Only update the state if provided
    const finalSetOpen = externalOnOpenChange || setInternalOpen
    finalSetOpen(newOpen)

    // Clear hash when closing if it's a settings hash
    if (!newOpen && window.location.hash.startsWith('#settings')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  // Handle hash changes to open modal and navigate to correct tab
  const handleHashChange = useCallback(() => {
    const hash = window.location.hash
    if (hash.startsWith('#settings')) {
      // Only open modal if it's not already open
      const finalSetOpen = externalOnOpenChange || setInternalOpen
      if (!open) {
        finalSetOpen(true)
      }

      // Navigate to the correct tab
      if (hash.includes('/')) {
        const tabFromHash = hash.replace('#settings/', '').toLowerCase()
        // Find the matching tab ID
        const matchingTab = data.nav.find(tab =>
          tab.name.toLowerCase() === tabFromHash || tab.id === tabFromHash
        )
        if (matchingTab) {
          setActiveTab(matchingTab.id)
        } else {
          // If no matching tab found, default to first tab
          setActiveTab(data.nav[0].id)
        }
      } else {
        // No tab specified, default to first tab
        setActiveTab(data.nav[0].id)
      }
    } else if (hash === '') {
      // Close modal when hash is cleared
      const finalSetOpen = externalOnOpenChange || setInternalOpen
      finalSetOpen(false)
    }
  }, [open, externalOnOpenChange])

  useEffect(() => {
    // Check initial hash on mount
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [handleHashChange])

  // State management
  const [displayName, setDisplayName] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)
  const [dateTimePreference, setDateTimePreference] = useState("24h")

  // Tab state - initialize from URL hash or initialTab prop
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL hash first
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash.startsWith('#settings/')) {
        const tabFromHash = hash.replace('#settings/', '')
        // Capitalize first letter to match our tab IDs
        return tabFromHash.charAt(0).toUpperCase() + tabFromHash.slice(1).toLowerCase()
      }
    }
    // Fall back to initialTab prop or default
    return initialTab || "general"
  })

  // Update activeTab when initialTab prop changes
  useEffect(() => {
    if (initialTab && !window.location.hash.startsWith('#settings/')) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // Security state
  const [newEmail, setNewEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false)
  const [emailOTPCode, setEmailOTPCode] = useState("")
  const [isVerifyingEmailOTP, setIsVerifyingEmailOTP] = useState(false)
  const [isResendingEmailOTP, setIsResendingEmailOTP] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteDetails, setDeleteDetails] = useState("")

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [isLoadingTOTP, setIsLoadingTOTP] = useState(false)
  const [showTOTPSetup, setShowTOTPSetup] = useState(false)
  const [showTOTPDisable, setShowTOTPDisable] = useState(false)
  const [totpSecret, setTotpSecret] = useState("")
  const [, setTotpUri] = useState("")
  const [totpQrCode, setTotpQrCode] = useState("")
  const [totpToken, setTotpToken] = useState("")
  const [disableToken, setDisableToken] = useState("")
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("")
  const [isVerifyingTOTP, setIsVerifyingTOTP] = useState(false)
  const [isDisablingTOTP, setIsDisablingTOTP] = useState(false)

  // Session management state
  const [sessionExpiry, setSessionExpiry] = useState("5184000")
  const [userSessions, setUserSessions] = useState<any[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1)
  const [sessionsTotal, setSessionsTotal] = useState(0)

  // Device management state
  const [userDevices, setUserDevices] = useState<any[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [devicesPage, setDevicesPage] = useState(1)
  const [devicesTotalPages, setDevicesTotalPages] = useState(1)
  const [devicesTotal, setDevicesTotal] = useState(0)
  const [devicePlan, setDevicePlan] = useState<{
    name: string;
    maxDevices: number;
    currentDevices: number;
  } | null>(null)
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState("")

  // Security events state
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [isLoadingSecurityEvents, setIsLoadingSecurityEvents] = useState(false)
  const [securityEventsPage, setSecurityEventsPage] = useState(1)
  const [securityEventsTotal, setSecurityEventsTotal] = useState(0)
  const [securityEventsHasMore, setSecurityEventsHasMore] = useState(false)
  const [activityMonitorEnabled, setActivityMonitorEnabled] = useState(true)
  const [detailedEventsEnabled, setDetailedEventsEnabled] = useState(true)
  const [showDisableMonitorDialog, setShowDisableMonitorDialog] = useState(false)

  // Recovery codes state
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [showRecoveryCodesModal, setShowRecoveryCodesModal] = useState(false)

  // Track which data has been loaded to prevent duplicate fetches
  const loadedRef = React.useRef(false)

  // Referral state
  const [referralCode, setReferralCode] = useState("")
  const [referralLink, setReferralLink] = useState("")
  const [copiedLink, setCopiedLink] = useState(false)
  const [referralStats, setReferralStats] = useState<{
    completedReferrals: number
    pendingReferrals: number
    totalEarningsMB: number
    currentBonusMB: number
    maxBonusMB: number
    maxReferrals: number
    totalReferralsCount: number
  } | null>(null)
  const [recentReferrals, setRecentReferrals] = useState<Referral[]>([])
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [referralsPage, setReferralsPage] = useState(1)
  const [referralsTotal, setReferralsTotal] = useState(0)

  // Billing state
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null)
  const [, setPricingPlans] = useState<PricingPlan[]>([])
  const [isLoadingBilling, setIsLoadingBilling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showCancelReasonDialog, setShowCancelReasonDialog] = useState(false)
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false)
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [cancelReason, setCancelReason] = useState<string>("")
  const [cancelReasonDetails, setCancelReasonDetails] = useState<string>("")
  const [isRedirectingToPortal, setIsRedirectingToPortal] = useState(false)
  const [subsPage, setSubsPage] = useState(1)
  const [subsTotalPages, setSubsTotalPages] = useState(1)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(1)

  // Notification preferences state
  const [inAppNotifications, setInAppNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loginNotifications, setLoginNotifications] = useState(true)
  const [fileShareNotifications, setFileShareNotifications] = useState(true)
  const [billingNotifications, setBillingNotifications] = useState(true)
  const [isLoadingNotificationPrefs, setIsLoadingNotificationPrefs] = useState(false)

  // Initialize display name from user data
  useEffect(() => {
    if (user) {
      // Use name if available, otherwise derive from email or empty string
      const nameToUse = user.name || (user.email ? user.email.split('@')[0] : "");
      setDisplayName(nameToUse);
      setOriginalName(nameToUse);
    }
  }, [user]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Register upload completion callback to refresh referral data
  useEffect(() => {
    const handleUploadComplete = () => {
      // Refresh referral data when any upload completes
      if (activeTab === "referrals") {
        loadReferralData()
      }
      // Refresh billing data when any upload completes (for usage updates)
      if (activeTab === "billing") {
        loadBillingData()
        loadSubscriptionHistory()
      }
    }

    registerOnUploadComplete(handleUploadComplete)

    return () => {
      unregisterOnUploadComplete(handleUploadComplete)
    }
  }, [activeTab, registerOnUploadComplete, unregisterOnUploadComplete])

  // Load data when modal opens (only once per session)
  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true
      loadTOTPStatus()
      loadReferralData(1)
      loadNotificationPreferences()
      loadSessionConfig()
      loadBillingData()
      loadSubscriptionHistory(1, 1)
      loadUserSessions(1)
      loadUserDevices(1)
    }
  }, [open])

  // Load context-sensitive data when switching tabs
  useEffect(() => {
    if (activeTab === "security" && open) {
      loadUserSessions()
      loadUserDevices()
      loadSecurityEvents(1)
      loadSecurityPreferences()
    }
  }, [activeTab, open])

  // Reset loaded state and form data when modal closes
  useEffect(() => {
    if (!open) {
      loadedRef.current = false

      // Reset Profile Edit
      setIsEditingName(false)
      setDisplayName("")
      setOriginalName("")

      // Reset Security Modals
      setNewEmail("")
      setConfirmEmail("")
      setEmailPassword("")
      setIsChangingEmail(false)
      setShowEmailModal(false)
      setShowEmailOTPModal(false)
      setEmailOTPCode("")
      setIsVerifyingEmailOTP(false)
      setIsResendingEmailOTP(false)

      setIsChangingPassword(false)
      setShowPasswordModal(false)

      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeleteConfirmation("")

      // Reset TOTP
      setShowTOTPSetup(false)
      setShowTOTPDisable(false)
      setTotpSecret("")
      setTotpQrCode("")
      setTotpToken("")
      setDisableToken("")
      setDisableRecoveryCode("")
      setIsVerifyingTOTP(false)
      setIsDisablingTOTP(false)

      // Reset Recovery Codes
      setShowRecoveryCodesModal(false)
      setRecoveryCodes([])

      // Reset Billing
      setShowCancelDialog(false)
      setShowCancelReasonDialog(false)
      setIsCancellingSubscription(false)
      setCancelReason("")
      setCancelReasonDetails("")

      // Reset Security
      setSecurityEventsPage(1)
    }
  }, [open])

  // Load session configuration
  const loadSessionConfig = async () => {
    if (typeof window !== 'undefined') {
      // First try to fetch from backend API
      try {
        const response = await apiClient.getProfile()
        if (response.success && response.data?.user?.sessionDuration) {
          setSessionExpiry(response.data.user.sessionDuration.toString())
          // Also save to localStorage for offline access
          const sessionConfig = {
            sessionExpiry: response.data.user.sessionDuration,
            remindBeforeExpiry: 300
          }
          localStorage.setItem('session_config', JSON.stringify(sessionConfig))
          return
        }
      } catch (error) {
        console.error('Failed to fetch session duration from API:', error)
      }

      // Fallback to localStorage if API fails
      const stored = localStorage.getItem('session_config')
      if (stored) {
        try {
          const config = JSON.parse(stored)
          setSessionExpiry(config.sessionExpiry.toString())
        } catch (e) {
          console.error('Failed to parse stored session config:', e)
          setSessionExpiry('5184000')
        }
      }
    }
  }

  // Load TOTP status
  const loadTOTPStatus = async () => {
    try {
      const response = await apiClient.getTOTPStatus()
      if (response.success && response.data) {
        setTotpEnabled(response.data.enabled)
      } else if (response.error) {
        // Log error but don't crash - default to disabled
        console.warn('Failed to load TOTP status:', response.error)
        setTotpEnabled(false)
      }
    } catch (error) {
      console.error('Failed to load TOTP status:', error)
      setTotpEnabled(false)
    }
  }

  // Load referral data
  const loadReferralData = async (page = referralsPage) => {
    setIsLoadingReferrals(true)
    try {
      const response = await apiClient.getReferralInfo(page, 5)
      if (response.success && response.data) {
        setReferralCode(response.data.referralCode)
        // Generate referral link from code
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        setReferralLink(`${baseUrl}/register?ref=${response.data.referralCode}`)
        setReferralStats(response.data.stats)
        setRecentReferrals(response.data.recentReferrals || [])
        setReferralsTotal(response.data.pagination?.total || 0)
        setReferralsPage(page)
      } else if (response.error) {
        // Log error but don't crash - set empty defaults
        console.warn('Failed to load referral data:', response.error)
        setReferralCode('')
        setReferralLink('')
        setReferralStats(null)
        setRecentReferrals([])
      }
    } catch (error) {
      console.error('Failed to load referral data:', error)
      setReferralCode('')
      setReferralLink('')
      setReferralStats(null)
      setRecentReferrals([])
    } finally {
      setIsLoadingReferrals(false)
    }
  }

  // Load billing data
  const loadBillingData = async () => {
    setIsLoadingBilling(true)
    try {
      // Load subscription status
      const subscriptionResponse = await apiClient.getSubscriptionStatus()
      if (subscriptionResponse.success && subscriptionResponse.data) {
        setSubscription(subscriptionResponse.data.subscription)
        setBillingUsage(subscriptionResponse.data.usage)
      } else {
        setSubscription(null)
        setBillingUsage(null)
      }

      // Load pricing plans
      const plansResponse = await apiClient.getPricingPlans()
      if (plansResponse.success && plansResponse.data) {
        setPricingPlans(plansResponse.data.plans || [])
      } else {
        setPricingPlans([])
      }
    } catch (error) {
      console.error('Failed to load billing data:', error)
      setSubscription(null)
      setBillingUsage(null)
      setPricingPlans([])
    } finally {
      setIsLoadingBilling(false)
    }
  }

  // Load subscription history
  const loadSubscriptionHistory = async (sPage = subsPage, iPage = invoicesPage) => {
    setIsLoadingHistory(true)
    try {
      const response = await apiClient.getSubscriptionHistory({
        subsPage: sPage,
        subsLimit: 5,
        invoicesPage: iPage,
        invoicesLimit: 5
      })
      if (response.success && response.data) {
        setSubscriptionHistory(response.data)
        setSubsTotalPages(response.data.pagination?.subs?.totalPages || 1)
        setInvoicesTotalPages(response.data.pagination?.invoices?.totalPages || 1)
        setSubsPage(sPage)
        setInvoicesPage(iPage)
      } else {
        setSubscriptionHistory(null)
      }
    } catch (error) {
      console.error('Failed to load subscription history:', error)
      setSubscriptionHistory(null)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Load notification preferences
  const loadNotificationPreferences = async () => {
    setIsLoadingNotificationPrefs(true)
    try {
      const response = await apiClient.getNotificationPreferences()
      if (response.success && response.data) {
        setInAppNotifications(response.data.inApp ?? true)
        setEmailNotifications(response.data.email ?? true)
        setLoginNotifications(response.data.login ?? true)
        setFileShareNotifications(response.data.fileShare ?? true)
        setBillingNotifications(response.data.billing ?? true)
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
      // Set defaults if API fails
      setInAppNotifications(true)
      setEmailNotifications(true)
      setLoginNotifications(true)
      setFileShareNotifications(true)
      setBillingNotifications(true)
    } finally {
      setIsLoadingNotificationPrefs(false)
    }
  }

  // Save notification preferences immediately with provided values (prevents stale closure)
  const saveNotificationPreferences = async (preferences?: {
    inApp?: boolean;
    email?: boolean;
    login?: boolean;
    fileShare?: boolean;
    billing?: boolean;
  }) => {
    try {
      // Use provided values or fall back to current state
      const preferencesToSave = {
        inApp: preferences?.inApp ?? inAppNotifications,
        email: preferences?.email ?? emailNotifications,
        login: preferences?.login ?? loginNotifications,
        fileShare: preferences?.fileShare ?? fileShareNotifications,
        billing: preferences?.billing ?? billingNotifications
      }

      const response = await apiClient.updateNotificationPreferences(preferencesToSave)
      if (response.success) {
        toast.success("Notification preferences updated!")
      } else {
        toast.error(response.error || "Failed to update notification preferences")
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
      toast.error("Failed to update notification preferences")
    }
  }



  // Load active sessions
  const loadUserSessions = async (page = sessionsPage) => {
    setIsLoadingSessions(true)
    try {
      const response = await apiClient.getSessions(page, 5)
      if (response.success && response.data) {
        setUserSessions(response.data.sessions || [])
        setCurrentSessionId(response.data.currentSessionId || null)
        setSessionsTotalPages(response.data.pagination?.totalPages || 1)
        setSessionsTotal(response.data.pagination?.total || 0)
        setSessionsPage(page)
      } else {
        setUserSessions([])
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setUserSessions([])
    } finally {
      setIsLoadingSessions(false)
    }
  }

  // Revoke a specific session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await apiClient.revokeSession(sessionId)
      if (response.success) {
        toast.success("Session revoked")
        loadUserSessions()
      } else {
        toast.error(response.error || "Failed to revoke session")
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      toast.error("Failed to revoke session")
    }
  }

  // Revoke all other sessions
  const handleRevokeAllSessions = async () => {
    try {
      const response = await apiClient.revokeAllSessions()
      if (response.success) {
        toast.success("All other sessions revoked")
        loadUserSessions()
        if (deviceLimitReached) {
          toast.info("Sessions Revoked. Please refresh the page to regain full access.", {
            duration: 10000,
            action: {
              label: "Refresh Now",
              onClick: () => window.location.reload()
            }
          })
        }
      } else {
        toast.error(response.error || "Failed to revoke sessions")
      }
    } finally {
      setShowRevokeAllDialog(false)
    }
  }

  // Load authorized devices
  const loadUserDevices = async (page = devicesPage) => {
    setIsLoadingDevices(true)
    try {
      const response = await apiClient.getDevices(page, 5)
      if (response.success && response.data) {
        setUserDevices(response.data.devices || [])
        setDevicesTotalPages(response.data.pagination?.totalPages || 1)
        setDevicesTotal(response.data.pagination?.total || 0)
        setDevicesPage(page)
        setDevicePlan(response.data.plan || null)
      } else {
        setUserDevices([])
      }
    } catch (error) {
      console.error('Failed to load devices:', error)
      setUserDevices([])
    } finally {
      setIsLoadingDevices(false)
    }
  }

  // Revoke a specific device
  const handleRevokeDevice = async (deviceId: string) => {
    try {
      const response = await apiClient.revokeDevice(deviceId)
      if (response.success) {
        toast.success("Device revoked")
        loadUserDevices()
        if (deviceLimitReached) {
          toast.info("Access Restored? Please refresh the page to regain full access.", {
            duration: 10000,
            action: {
              label: "Refresh Now",
              onClick: () => window.location.reload()
            }
          })
        }
      } else {
        toast.error(response.error || "Failed to revoke device")
      }
    } catch (error) {
      console.error('Failed to revoke device:', error)
      toast.error("Failed to revoke device")
    }
  }

  // Load security preferences
  const loadSecurityPreferences = async () => {
    try {
      const response = await apiClient.getSecurityPreferences()
      if (response.success && response.data) {
        setActivityMonitorEnabled(response.data.activityMonitorEnabled)
        setDetailedEventsEnabled(response.data.detailedEventsEnabled)
      }
    } catch (error) {
      console.error('Failed to load security preferences:', error)
    }
  }

  // Update security preferences
  const handleUpdateSecurityPreferences = async (activity: boolean, detailed: boolean) => {
    try {
      const response = await apiClient.updateSecurityPreferences(activity, detailed)
      if (response.success) {
        setActivityMonitorEnabled(activity)
        setDetailedEventsEnabled(detailed)
        toast.success("Preferences updated")
      } else {
        toast.error(response.error || "Failed to update preferences")
      }
    } catch (error) {
      console.error('Failed to update security preferences:', error)
      toast.error("Failed to update preferences")
    }
  }

  // Load security events history
  const loadSecurityEvents = async (page: number = 1) => {
    setIsLoadingSecurityEvents(true)
    try {
      const limit = 10
      const offset = (page - 1) * limit
      const response = await apiClient.getSecurityEvents(limit, offset)
      if (response.success && response.data) {
        setSecurityEvents(response.data.events || [])
        if (response.data.pagination) {
          setSecurityEventsTotal(response.data.pagination.total || 0)
          setSecurityEventsHasMore(!!response.data.pagination.hasMore)
        }
        setSecurityEventsPage(page)
      } else {
        setSecurityEvents([])
        setSecurityEventsTotal(0)
        setSecurityEventsHasMore(false)
      }
    } catch (error) {
      console.error('Failed to load security events:', error)
    } finally {
      setIsLoadingSecurityEvents(false)
    }
  }

  // Wipe security history
  const handleWipeSecurityEvents = async () => {
    try {
      const response = await apiClient.wipeSecurityEvents()
      if (response.success) {
        toast.success("Security history wiped")
        loadSecurityEvents(1)
      } else {
        toast.error(response.error || "Failed to wipe security history")
      }
    } catch (error) {
      console.error('Failed to wipe security history:', error)
      toast.error("Failed to wipe security history")
    }
  }

  // Download security history
  const handleDownloadSecurityEvents = async () => {
    try {
      const response = await apiClient.getSecurityEvents(1000, 0) // Get more for download
      if (response.success && response.data) {
        const events = response.data.events
        const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `security-history-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download security history:', error)
      toast.error("Failed to download security history")
    }
  }

  // Update device name
  const handleUpdateDeviceName = async (deviceId: string, newName: string) => {
    if (!newName.trim()) return
    try {
      const response = await apiClient.renameDevice(deviceId, newName)
      if (response.success) {
        toast.success("Device name updated")
        loadUserDevices()
      } else {
        toast.error(response.error || "Failed to update device name")
      }
    } catch (error) {
      console.error('Failed to update device name:', error)
      toast.error("Failed to update device name")
    } finally {
      setEditingDeviceId(null)
    }
  }

  // Format time ago for display
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'just now'
  }

  // Format date for session display (DD/MM/YYYY HH:MM AM/PM)
  const formatSessionDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'

    hours = hours % 12
    hours = hours ? hours : 12 // the hour '0' should be '12'
    const strHours = String(hours).padStart(2, '0')

    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`
  }

  // Get OS and Browser info from user agent
  const getUAInfo = (userAgent: string) => {
    if (!userAgent) return { osIcon: <IconWorld className="h-3.5 w-3.5" />, osName: 'Unknown', browserIcon: <IconWorld className="h-3.5 w-3.5" />, browserName: 'Unknown' };
    const ua = userAgent.toLowerCase();

    let osIcon = <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
    let osName = 'Unknown OS';

    if (ua.includes('win')) { osIcon = <WindowsIcon className="h-3.5 w-3.5" />; osName = 'Windows'; }
    else if (ua.includes('mac')) { osIcon = <AppleIcon className="h-3.5 w-3.5" />; osName = 'macOS'; }
    else if (ua.includes('iphone') || ua.includes('ipad')) { osIcon = <AppleIcon className="h-3.5 w-3.5" />; osName = 'iOS'; }
    else if (ua.includes('android')) { osIcon = <AndroidIcon className="h-3.5 w-3.5" />; osName = 'Android'; }
    else if (ua.includes('linux')) { osIcon = <UbuntuIcon className="h-3.5 w-3.5" />; osName = 'Linux'; }

    let browserIcon = <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
    let browserName = 'Unknown Browser';

    if (ua.includes('edg')) { browserIcon = <EdgeIcon className="h-3.5 w-3.5" />; browserName = 'Edge'; }
    else if (ua.includes('opr')) { browserIcon = <OperaIcon className="h-3.5 w-3.5" />; browserName = 'Opera'; }
    else if (ua.includes('chrome') || ua.includes('crios')) { browserIcon = <ChromeIcon className="h-3.5 w-3.5" />; browserName = 'Chrome'; }
    else if (ua.includes('firefox') || ua.includes('fxios')) { browserIcon = <FirefoxIcon className="h-3.5 w-3.5" />; browserName = 'Firefox'; }
    else if (ua.includes('safari') && !ua.includes('chrome')) { browserIcon = <SafariIcon className="h-3.5 w-3.5" />; browserName = 'Safari'; }

    return { osIcon, osName, browserIcon, browserName };
  }

  // Copy referral code to clipboard
  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedCode(true)
      toast.success("Referral code copied!")
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      console.error('Failed to copy referral code:', error)
      toast.error("Failed to copy referral code")
    }
  }

  // Copy referral link to clipboard
  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      toast.success("Referral link copied!")
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (error) {
      console.error('Failed to copy referral link:', error)
      toast.error("Failed to copy referral link")
    }
  }

  // Cancel subscription
  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true)
    try {
      // Cancel the subscription first
      const response = await apiClient.cancelSubscription()
      if (response.success) {
        toast.success('Subscription cancelled successfully. You will retain access until the end of your billing period.')
        // Reload billing data
        await loadBillingData()
        // Now show the cancellation reason dialog
        setShowCancelDialog(false)
        setShowCancelReasonDialog(true)
      } else {
        toast.error(response.error || 'Failed to cancel subscription')
      }
    } catch (error) {
      console.error('Cancel subscription error:', error)
      toast.error('Failed to cancel subscription')
    } finally {
      setIsCancellingSubscription(false)
    }
  }

  // Submit cancellation reason (subscription already cancelled)
  const handleConfirmCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please select a reason for cancellation')
      return
    }

    setIsCancellingSubscription(true)
    try {
      // Send cancellation reason to backend (will webhook to Discord)
      const cancelResponse = await apiClient.cancelSubscriptionWithReason({
        reason: cancelReason,
        details: cancelReasonDetails
      })

      if (cancelResponse.success) {
        toast.success('Thank you for your feedback!')
      } else {
        toast.error(cancelResponse.error || 'Failed to submit feedback')
      }
    } catch (error) {
      console.error('Submit cancellation reason error:', error)
      toast.error('Failed to submit feedback')
    } finally {
      setIsCancellingSubscription(false)
      setShowCancelReasonDialog(false)
      setCancelReason("")
      setCancelReasonDetails("")
    }
  }

  // Manage subscription (redirect to Stripe portal)
  const handleManageSubscription = async () => {
    setIsRedirectingToPortal(true)
    try {
      // Clean return URL to avoid parameter accumulation and loops
      // Always redirects to the billing settings tab
      const returnUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/#settings/Billing`
        : 'https://drive.ellipticc.com/#settings/Billing'

      const response = await apiClient.createPortalSession({ returnUrl })

      if (response.success && response.data?.url) {
        window.location.href = response.data.url
      } else {
        toast.error(response.error || "Failed to create portal session")
        setIsRedirectingToPortal(false)
      }
    } catch (error) {
      console.error('Portal session error:', error)
      toast.error("Failed to redirect to billing portal")
      setIsRedirectingToPortal(false)
    }
  }

  // Format storage size for display
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0MB'

    const mb = bytes / (1024 * 1024)
    if (mb < 1024) {
      return `${Math.round(mb)}MB`
    } else {
      const gb = mb / 1024
      return `${gb.toFixed(1)}GB`
    }
  }

  // Extract display name from email (e.g., "john" from "john@doe.com")
  const getDisplayNameFromEmail = (email: string): string => {
    if (!email) return 'Unknown'
    const atIndex = email.indexOf('@')
    if (atIndex === -1) return email
    const prefix = email.substring(0, atIndex)
    // Capitalize first letter
    return prefix.charAt(0).toUpperCase() + prefix.slice(1)
  }

  // Handle avatar click to open file picker
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // Handle avatar file selection and upload
  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB")
      return
    }

    setIsLoadingAvatar(true)
    try {
      // Compress image client-side before hashing and uploading
      // Uses fixed parameters (512px, 0.8 quality, JPEG) for deterministic output
      const compressedBlob = await compressAvatar(file);

      // Calculate SHA256 hash of the COMPRESSED image for idempotency
      const buffer = await compressedBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const formData = new FormData()
      // Use compressed blob instead of original file
      formData.append('file', compressedBlob, 'avatar.jpg')

      // Pass the hash as the idempotency key (header)
      const uploadResponse = await apiClient.uploadAvatar(formData, fileHash)

      if (uploadResponse.success && uploadResponse.data?.avatarUrl) {
        // Update the user's profile with the new avatar URL
        await apiClient.updateUserProfile({
          avatar: uploadResponse.data.avatarUrl
        })
        // Force refetch to update user data
        await refetch()
        toast.success("Avatar updated successfully!")
      } else {
        if (uploadResponse.error === 'This image is already set as your avatar.') {
          toast.error("This image is already set as your avatar.");
        } else {
          toast.error(uploadResponse.error || "Failed to upload avatar");
        }
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast.error("Failed to upload avatar")
    } finally {
      setIsLoadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Handle display name save
  const handleSaveName = async () => {
    if (displayName === originalName) {
      setIsEditingName(false)
      return
    }

    if (!displayName.trim()) {
      toast.error("Display name cannot be empty")
      return
    }

    setIsSavingName(true)
    try {
      const response = await apiClient.updateUserProfile({
        name: displayName.trim()
      })

      if (response.success) {
        setOriginalName(displayName.trim())
        setIsEditingName(false)
        await refetch()
        toast.success("Display name updated!")
      } else {
        toast.error(response.error || "Failed to update display name")
      }
    } catch (error) {
      console.error('Failed to update display name:', error)
      toast.error("Failed to update display name")
    } finally {
      setIsSavingName(false)
    }
  }

  // Handle display name cancel
  const handleCancelEdit = () => {
    setDisplayName(originalName)
    setIsEditingName(false)
  }

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    if (!user?.avatar) return;

    try {
      setIsLoadingAvatar(true)

      const response = await apiClient.updateUserProfile({
        avatar: ""
      })

      if (response.success) {
        // Immediately notify context to refresh
        await refetch()
        toast.success("Avatar removed successfully!")
      } else {
        toast.error("Failed to remove avatar")
      }
    } catch (error) {
      console.error('Avatar removal error:', error)
      toast.error("Failed to remove avatar")
    } finally {
      setIsLoadingAvatar(false)
    }
  }

  // Check if current avatar is a DiceBear avatar
  const isDiceBearAvatar = user?.avatar && user.avatar.includes('dicebear-api.com')



  // Handle email OTP verification
  const handleVerifyEmailOTP = async () => {
    if (!emailOTPCode.trim()) {
      toast.error("Please enter the OTP code")
      return
    }

    setIsVerifyingEmailOTP(true)
    try {
      const emailChangeToken = sessionStorage.getItem('emailChangeToken')
      if (!emailChangeToken) {
        toast.error("Email change session expired. Please try again.")
        return
      }

      const response = await apiClient.verifyEmailChange(emailChangeToken, emailOTPCode.trim())

      if (response.success) {
        toast.success("Email changed successfully! Please log in again with your new email address.")

        // Clear session storage
        sessionStorage.removeItem('emailChangeToken')
        sessionStorage.removeItem('newEmail')

        // Close OTP modal
        setShowEmailOTPModal(false)
        setEmailOTPCode("")

        // Log out the user to force re-login with new email
        await completeLogout()

        // Redirect to login page
        window.location.href = '/login'
      } else {
        toast.error(response.error || "Invalid OTP code")
      }
    } catch (error) {
      console.error('Email OTP verification error:', error)
      toast.error("Failed to verify OTP")
    } finally {
      setIsVerifyingEmailOTP(false)
    }
  }

  // Handle resend email OTP
  const handleResendEmailOTP = async () => {
    const newEmail = sessionStorage.getItem('newEmail')
    if (!newEmail) {
      toast.error("Email change session expired. Please try again.")
      return
    }

    setIsResendingEmailOTP(true)
    try {
      const response = await apiClient.initiateEmailChange(newEmail)
      if (response.success) {
        const emailChangeToken = response.data?.emailChangeToken
        if (emailChangeToken) {
          sessionStorage.setItem('emailChangeToken', emailChangeToken)
        }
        toast.success("OTP code resent to your new email address")
        setEmailOTPCode("")
      } else {
        toast.error(response.error || "Failed to resend OTP")
      }
    } catch (error) {
      console.error('Resend email OTP error:', error)
      toast.error("Failed to resend OTP")
    } finally {
      setIsResendingEmailOTP(false)
    }
  }

  // Complete logout with full cleanup
  const completeLogout = async () => {
    try {
      // Call logout API
      await apiClient.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    }

    // Clear all local storage
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })
    }

    // Clear user context (this will trigger re-render)
    // The user context should handle clearing its own state
  }

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await completeLogout()
      toast.success("Logged out successfully")
      // Redirect to login page immediately
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
      toast.error("Failed to logout")
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm account deletion")
      return
    }

    setIsDeletingAccount(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://drive.ellipticc.com/api/v1'}/auth/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiClient.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: deleteReason,
          details: deleteDetails
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Complete cleanup
        await completeLogout()
        toast.success("Account deleted successfully")
        // Redirect to landing page
        window.location.href = '/'
      } else {
        toast.error(data.error || "Failed to delete account")
      }
    } catch (error) {
      console.error('Delete account error:', error)
      toast.error("Failed to delete account")
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeleteConfirmation("")
      setDeleteReason("")
      setDeleteDetails("")
    }
  }

  // Handle TOTP setup
  const handleTOTPSetup = async () => {
    setIsLoadingTOTP(true)
    try {
      const response = await apiClient.setupTOTP()
      if (response.success && response.data) {
        setTotpSecret(response.data.secret)
        setTotpUri(response.data.totpUri)
        setTotpQrCode(response.data.qrCode)
        setShowTOTPSetup(true)
      } else {
        toast.error("Failed to setup TOTP")
      }
    } catch (error) {
      console.error('TOTP Setup Error:', error)
      toast.error("Failed to setup TOTP")
    } finally {
      setIsLoadingTOTP(false)
    }
  }

  // Handle TOTP verification and enable
  const handleTOTPVerify = async () => {
    if (!totpToken.trim()) {
      toast.error("Please enter the TOTP token")
      return
    }

    setIsVerifyingTOTP(true)
    try {
      const response = await apiClient.verifyTOTPSetup(totpToken.trim())
      if (response.success && response.data) {
        setRecoveryCodes(response.data.recoveryCodes)
        setTotpEnabled(true)
        setShowTOTPSetup(false)
        setShowRecoveryCodesModal(true)
        toast.success("TOTP enabled successfully!")
        // Reset form
        setTotpToken("")
        setTotpSecret("")
        setTotpUri("")
        setTotpQrCode("")
      } else {
        toast.error("Invalid TOTP token")
      }
    } catch (error) {
      console.error('TOTP verification error:', error)
      toast.error("Failed to verify TOTP token")
    } finally {
      setIsVerifyingTOTP(false)
    }
  }

  // Handle TOTP disable
  const handleTOTPDisable = async () => {
    if (!disableToken.trim() && !disableRecoveryCode.trim()) {
      toast.error("Please enter either a TOTP token or recovery code")
      return
    }

    if (disableToken && !/^\d{6}$/.test(disableToken)) {
      toast.error("TOTP token must be 6 digits")
      return
    }

    if (disableRecoveryCode && disableRecoveryCode.length !== 8) {
      toast.error("Recovery code must be 8 characters")
      return
    }

    setIsDisablingTOTP(true)
    try {
      const response = await apiClient.disableTOTP(disableToken || undefined, disableRecoveryCode || undefined)
      if (response.success) {
        setTotpEnabled(false)
        setShowTOTPDisable(false)
        setDisableToken("")
        setDisableRecoveryCode("")
        toast.success("TOTP disabled successfully")
        // Reload TOTP status to ensure UI is updated
        await loadTOTPStatus()
      } else {
        toast.error(response.error || "Failed to disable TOTP")
      }
    } catch (error) {
      console.error('Disable TOTP error:', error)
      toast.error("Failed to disable TOTP")
    } finally {
      setIsDisablingTOTP(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <DialogTrigger asChild>
          {children || (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <IconSettings className="h-4 w-4" />
            </Button>
          )}
        </DialogTrigger>
      ) : (
        children
      )}
      <DialogContent showCloseButton={false} className={`${isMobile ? 'w-[90vw] h-[75vh] max-w-none max-h-none overflow-y-auto' : 'md:h-[700px] md:max-w-[1100px] overflow-hidden'} p-0`}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start h-full min-h-0">
          <Sidebar collapsible="none" className="hidden md:flex flex-none w-56 h-full border-r">
            <SidebarHeader className="p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenChange(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Close settings"
              >
                <IconX className="h-5 w-5" />
              </Button>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {data.nav.map((item) => {
                      const isDisabled = deviceLimitReached && item.id !== "security";
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={activeTab === item.id}
                            disabled={isDisabled}
                            className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <button
                              onClick={() => !isDisabled && handleTabChange(item.id)}
                              className={isDisabled ? "cursor-not-allowed pointer-events-none" : ""}
                            >
                              <item.icon />
                              <span>{item.name}</span>
                            </button>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex flex-1 flex-col h-full relative">
            {/* Mobile Navigation */}
            {isMobile && (
              <div className="border-b border-border p-4 flex-shrink-0 sticky top-0 bg-background">
                <div className="flex gap-1 overflow-x-auto">
                  {data.nav.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-4 p-6 pb-20 overflow-y-auto scroll-smooth">
              {activeTab === "general" && (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">General</h2>
                    <div className="flex items-start gap-6">
                      {/* Avatar */}
                      <div className="relative group">
                        <Avatar
                          className="h-20 w-20 cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0"
                          onClick={handleAvatarClick}
                        >
                          <AvatarImage
                            src={user?.avatar || getDiceBearAvatar(user?.id || "user")}
                            alt="Profile"
                            onError={(e) => {
                              // Prevent favicon.ico fallback request
                              (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                            }}
                          />
                          <AvatarFallback className="text-base">
                            {getInitials(displayName || "User")}
                          </AvatarFallback>
                        </Avatar>
                        {isLoadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                            <IconLoader2 className="h-5 w-5 animate-spin text-white" />
                          </div>
                        )}
                        {/* Remove avatar cross - only show for non-DiceBear avatars */}
                        {user?.avatar && !isDiceBearAvatar && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveAvatar()
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Remove avatar"
                          >
                            <span className="text-xs font-bold">×</span>
                          </button>
                        )}
                      </div>

                      {/* Display Name Section */}
                      <div className="flex-1 pt-1">
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="display-name" className="text-sm font-medium">
                              Display name
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                ref={nameInputRef}
                                id="display-name"
                                value={displayName}
                                onChange={(e) => {
                                  // Strict validation: Alphanumeric and spaces only, max 50 chars
                                  const val = e.target.value
                                  if (val.length <= 50 && /^[a-zA-Z0-9 ]*$/.test(val)) {
                                    setDisplayName(val)
                                  }
                                }}
                                placeholder={displayName || "Enter your name"}
                                readOnly={!isEditingName}
                                className={`flex-1 ${!isEditingName ? 'bg-muted cursor-not-allowed' : ''}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && isEditingName) handleSaveName()
                                  if (e.key === 'Escape' && isEditingName) handleCancelEdit()
                                }}
                              />
                              {isEditingName ? (
                                displayName === originalName ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    className="h-9 w-9 p-0"
                                    title="Cancel"
                                  >
                                    <IconX className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={handleSaveName}
                                    disabled={isSavingName || !displayName.trim()}
                                    className="h-9 w-9 p-0"
                                    title="Save name"
                                  >
                                    {isSavingName ? (
                                      <IconLoader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <IconCheckmark className="h-4 w-4" />
                                    )}
                                  </Button>
                                )
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setIsEditingName(true)}
                                  className="h-9 w-9 p-0"
                                  title="Edit display name"
                                >
                                  <IconPencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Appearance Section */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Appearance</h3>
                    <div className="space-y-2">
                      <Label htmlFor="theme-select" className="text-sm font-medium">
                        Theme
                      </Label>
                      <Select value={theme || "system"} onValueChange={setTheme}>
                        <SelectTrigger id="theme-select" className="w-full max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Date & Time Section */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Date & Time</h3>
                    <div className="space-y-2">
                      <Label htmlFor="datetime-select" className="text-sm font-medium">
                        Time format
                      </Label>
                      <Select value={dateTimePreference} onValueChange={setDateTimePreference}>
                        <SelectTrigger id="datetime-select" className="w-full max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                          <SelectItem value="24h">24-hour</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Choose how time is displayed throughout the application.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Security</h2>

                  {/* Wallet User Notice */}
                  {(user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet') && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-blue-900 dark:text-blue-100">MetaMask Authentication</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            You are authenticated via MetaMask wallet. Email, password, and two-factor authentication settings are managed through your wallet and cannot be modified here.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Change Email Section */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconMail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Email Address</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailModal(true)}
                      disabled={user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                    >
                      Change
                    </Button>
                  </div>

                  {/* Change Password Section */}
                  <div className="flex items-center justify-between border-t pt-6">
                    <div className="flex items-center gap-3">
                      <IconLock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">••••••••</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordModal(true)}
                      disabled={user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                    >
                      Change
                    </Button>
                  </div>

                  {/* TOTP Section */}
                  <div className="flex items-center justify-between border-t pt-6">
                    <div className="flex items-center gap-3">
                      <ShieldUser className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">
                          {totpEnabled ? "Enabled" : "Add an extra layer of security"}
                        </p>
                      </div>
                    </div>
                    {totpEnabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTOTPDisable(true)}
                        disabled={isLoadingTOTP || user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                      >
                        {isLoadingTOTP ? (
                          <>
                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          "Disable"
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTOTPSetup}
                        disabled={isLoadingTOTP || user?.email?.endsWith('@wallet.local') || user?.authMethod === 'wallet'}
                      >
                        {isLoadingTOTP ? (
                          <>
                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                            Setting up...
                          </>
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Session Duration Configuration Section */}
                  <div className="flex items-center justify-between border-t pt-6">
                    <div className="flex items-center gap-3 flex-1">
                      <IconRefresh className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col gap-1">
                        <p className="font-medium">Session Duration</p>
                        <p className="text-sm text-muted-foreground">
                          How long you can stay logged in before automatic logout
                        </p>
                      </div>
                    </div>
                    <Select
                      value={sessionExpiry}
                      onValueChange={async (value) => {
                        setSessionExpiry(value);
                        const sessionDuration = parseInt(value);

                        // Save to localStorage for immediate frontend use
                        const sessionConfig = {
                          sessionExpiry: sessionDuration,
                          remindBeforeExpiry: 300
                        };
                        localStorage.setItem('session_config', JSON.stringify(sessionConfig));

                        // Send to backend API to persist in database
                        try {
                          const response = await apiClient.updateSessionDuration(sessionDuration);
                          if (response.success) {
                            toast.success('Session duration updated');
                          } else {
                            toast.error(response.error || 'Failed to save session duration');
                          }
                        } catch (error) {
                          console.error('Error saving session duration:', error);
                          toast.error('Failed to save session duration');
                        }
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="86400">24 hours</SelectItem>
                        <SelectItem value="604800">7 days</SelectItem>
                        <SelectItem value="1209600">14 days</SelectItem>
                        <SelectItem value="2592000">30 days</SelectItem>
                        <SelectItem value="5184000">60 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Session Manager Section */}
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <IconShieldLock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Session Manager</p>
                          <p className="text-sm text-muted-foreground">Manage your active login sessions across devices</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {sessionsTotal > 5 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => loadUserSessions(sessionsPage - 1)}
                              disabled={sessionsPage === 1}
                            >
                              <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Page {sessionsPage} of {sessionsTotalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => loadUserSessions(sessionsPage + 1)}
                              disabled={sessionsPage >= sessionsTotalPages}
                            >
                              <IconChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isLoadingSessions || userSessions.filter(s => !s.isCurrent && !s.is_revoked).length === 0}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              Revoke All
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Revoke all other sessions?</DialogTitle>
                              <DialogDescription>
                                This will log you out of all other devices and browsers. You will remain logged in to your current session.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="mt-4">
                              <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleRevokeAllSessions}
                                className="bg-red-500 hover:bg-red-600 text-white"
                              >
                                Revoke All
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Session ID</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Device / Browser</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP Address</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {isLoadingSessions ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center">
                                  <IconLoader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                </td>
                              </tr>
                            ) : userSessions.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                  No active sessions found
                                </td>
                              </tr>
                            ) : (
                              userSessions.map((session) => (
                                <tr key={session.id} className={`hover:bg-muted/30 transition-colors ${session.is_revoked ? 'opacity-50' : ''}`}>
                                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                            {session.id.substring(0, 8)}...
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="font-mono text-xs">{session.id}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="font-medium truncate max-w-[200px]" title={session.user_agent}>
                                        {session.user_agent.includes('Windows') ? 'Windows' :
                                          session.user_agent.includes('Mac') ? 'macOS' :
                                            session.user_agent.includes('Linux') ? 'Linux' :
                                              session.user_agent.includes('Android') ? 'Android' :
                                                session.user_agent.includes('iPhone') ? 'iPhone' : 'Unknown Device'}
                                        {session.user_agent.includes('Chrome') ? ' (Chrome)' :
                                          session.user_agent.includes('Firefox') ? ' (Firefox)' :
                                            session.user_agent.includes('Safari') ? ' (Safari)' :
                                              session.user_agent.includes('Edge') ? ' (Edge)' : ''}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                    {session.ip_address}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                    {formatSessionDate(session.created_at)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {(!!session.isCurrent || (currentSessionId && session.id === currentSessionId)) && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase py-1 px-2 bg-emerald-100/50 dark:bg-emerald-950/30 rounded">
                                          Current
                                        </span>
                                      )}
                                      {!!session.is_revoked && (
                                        <span className="text-[10px] text-red-500 font-bold uppercase py-1 px-2 bg-red-100/50 dark:bg-red-950/30 rounded">
                                          Revoked
                                        </span>
                                      )}
                                      {(!session.isCurrent && (!currentSessionId || session.id !== currentSessionId) && !session.is_revoked) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRevokeSession(session.id)}
                                          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                          Revoke
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Device Manager Section */}
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <IconUserCog className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">Device Manager</p>
                            {devicePlan && (
                              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                {devicePlan.currentDevices}/{devicePlan.maxDevices} {devicePlan.name} Slots
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Manage authorized devices and cryptographic identities</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {devicesTotal > 5 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => loadUserDevices(devicesPage - 1)}
                              disabled={devicesPage === 1}
                            >
                              <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Page {devicesPage} of {devicesTotalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => loadUserDevices(devicesPage + 1)}
                              disabled={devicesPage >= devicesTotalPages}
                            >
                              <IconChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Device ID</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Device Name</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location / IP</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Active</th>
                              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {isLoadingDevices ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center">
                                  <IconLoader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                </td>
                              </tr>
                            ) : userDevices.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                  No authorized devices found
                                </td>
                              </tr>
                            ) : (
                              userDevices.map((device) => (
                                <tr key={device.id} className={`hover:bg-muted/30 transition-colors ${device.is_revoked ? 'opacity-50' : ''}`}>
                                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                            {device.id.substring(0, 8)}...
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="font-mono text-xs">{device.id}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                  <td className="px-4 py-3">
                                    <TooltipProvider>
                                      <Tooltip delayDuration={300}>
                                        <TooltipTrigger asChild>
                                          <div
                                            className="flex flex-col cursor-pointer group"
                                            onDoubleClick={() => {
                                              const isPro = devicePlan?.name === 'Pro' || devicePlan?.name === 'Unlimited';
                                              if (isPro) {
                                                setEditingDeviceId(device.id);
                                                setEditNameValue(device.device_name || 'Unknown Device');
                                              } else {
                                                toast.info("Pro Feature", {
                                                  description: "Upgrading to a Pro plan allows you to customize your device names."
                                                });
                                              }
                                            }}
                                          >
                                            {editingDeviceId === device.id ? (
                                              <Input
                                                value={editNameValue}
                                                onChange={(e) => setEditNameValue(e.target.value.slice(0, 30))}
                                                onBlur={() => {
                                                  const device = userDevices.find(d => d.id === editingDeviceId);
                                                  if (device && editNameValue.trim() !== device.device_name) {
                                                    handleUpdateDeviceName(device.id, editNameValue);
                                                  } else {
                                                    setEditingDeviceId(null);
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    const device = userDevices.find(d => d.id === editingDeviceId);
                                                    if (device && editNameValue.trim() !== device.device_name) {
                                                      handleUpdateDeviceName(device.id, editNameValue);
                                                    } else {
                                                      setEditingDeviceId(null);
                                                    }
                                                  }
                                                  if (e.key === 'Escape') setEditingDeviceId(null);
                                                }}
                                                className="h-7 text-xs py-0 px-2 w-full max-w-[150px]"
                                                autoFocus
                                              />
                                            ) : (
                                              <span className="font-medium group-hover:text-primary transition-colors truncate max-w-[180px]" title={device.device_name}>
                                                {device.device_name && device.device_name.length > 25
                                                  ? `${device.device_name.substring(0, 25)}...`
                                                  : (device.device_name || 'Unknown Device')}
                                              </span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
                                              {device.os} • {device.browser}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] text-center">
                                          {(devicePlan?.name === 'Pro' || devicePlan?.name === 'Unlimited') ? (
                                            <p className="text-xs">Double-click to rename device</p>
                                          ) : (
                                            <div className="space-y-1">
                                              <p className="text-xs font-bold">Pro Feature</p>
                                              <p className="text-[10px]">Upgrade to a Pro plan to customize your device names.</p>
                                            </div>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="text-xs">{device.location || 'Unknown'}</span>
                                      <span className="text-[10px] font-mono text-muted-foreground">
                                        {detailedEventsEnabled ? device.ip_address : '••••••••••••'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                    {formatSessionDate(device.last_active)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {!!device.is_current && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase py-1 px-2 bg-emerald-100/50 dark:bg-emerald-950/30 rounded">
                                          Current
                                        </span>
                                      )}
                                      {!!device.is_revoked && (
                                        <span className="text-[10px] text-red-500 font-bold uppercase py-1 px-2 bg-red-100/50 dark:bg-red-950/30 rounded">
                                          Revoked
                                        </span>
                                      )}
                                      {(!device.is_current && !device.is_revoked) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRevokeDevice(device.id)}
                                          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                          Revoke
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Activity Monitor Section */}
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <IconActivity className="h-5 w-5 text-muted-foreground" />
                          <h3 className="text-lg font-semibold">Activity Monitor</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Review security-related activity on your account</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadSecurityEvents(1)}
                          disabled={isLoadingSecurityEvents}
                          className="h-8 w-8 p-0"
                          title="Reload"
                        >
                          <IconRefresh className={`h-4 w-4 ${isLoadingSecurityEvents ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleWipeSecurityEvents}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          title="Wipe security history"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDownloadSecurityEvents}
                          className="h-8 w-8 p-0"
                          title="Download security history"
                        >
                          <IconDownload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="activity-monitor-toggle"
                          checked={activityMonitorEnabled}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              setShowDisableMonitorDialog(true)
                            } else {
                              handleUpdateSecurityPreferences(true, detailedEventsEnabled)
                            }
                          }}
                        />
                        <Label className="text-sm font-medium">Activity monitor</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id="detailed-events-toggle"
                          checked={detailedEventsEnabled}
                          onCheckedChange={(checked) => handleUpdateSecurityPreferences(activityMonitorEnabled, checked)}
                        />
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm font-medium">Enable detailed events</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-[10px]">Enabling detailed events records the IP address for each event.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">Event ID</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">Event</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">Location / IP</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">Status</th>
                              <th className="text-right px-4 py-2 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {isLoadingSecurityEvents && securityEvents.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                  <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                  Loading security events...
                                </td>
                              </tr>
                            ) : securityEvents.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                  No security events recorded yet.
                                </td>
                              </tr>
                            ) : (
                              securityEvents.map((event) => (
                                <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                            {event.id.substring(0, 8)}...
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="font-mono text-xs">{event.id}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-xs capitalize">
                                        {event.eventType.replace(/_/g, ' ')}
                                      </span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {(() => {
                                          const { osIcon, osName, browserIcon, browserName } = getUAInfo(event.userAgent);
                                          return (
                                            <>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger className="flex items-center">{osIcon}</TooltipTrigger>
                                                  <TooltipContent side="top"><p className="text-xs">{osName}</p></TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger className="flex items-center">{browserIcon}</TooltipTrigger>
                                                  <TooltipContent side="top"><p className="text-xs">{browserName}</p></TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="text-xs">{event.location || 'Unknown'}</span>
                                      <span className="text-[10px] font-mono text-muted-foreground">
                                        {detailedEventsEnabled ? event.ipAddress : '••••••••••••'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold uppercase py-0.5 px-1.5 rounded ${event.status === 'success'
                                      ? 'text-emerald-600 bg-emerald-100/50 dark:bg-emerald-950/30'
                                      : 'text-red-500 bg-red-100/50 dark:bg-red-950/30'
                                      }`}>
                                      {event.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatSessionDate(event.createdAt)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {securityEventsTotal > 10 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground">
                          Showing {securityEvents.length} of {securityEventsTotal} events
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => loadSecurityEvents(securityEventsPage - 1)}
                            disabled={securityEventsPage === 1 || isLoadingSecurityEvents}
                          >
                            <IconChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                            Page {securityEventsPage}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => loadSecurityEvents(securityEventsPage + 1)}
                            disabled={!securityEventsHasMore || isLoadingSecurityEvents}
                          >
                            <IconChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Dialog open={showDisableMonitorDialog} onOpenChange={setShowDisableMonitorDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Disable Activity Monitoring?</DialogTitle>
                        <DialogDescription>
                          Disabling the security activity monitor will stop logging new events.
                          You will no longer be able to review security history through the dashboard.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDisableMonitorDialog(false)}>Cancel</Button>
                        <Button
                          onClick={() => {
                            handleUpdateSecurityPreferences(false, detailedEventsEnabled)
                            setSecurityEvents([])
                            setSecurityEventsTotal(0)
                            setSecurityEventsHasMore(false)
                            setShowDisableMonitorDialog(false)
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          Disable Monitor
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Account Actions Section */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Account Actions</h3>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full"
                      >
                        {isLoggingOut ? (
                          <>
                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                            Logging out...
                          </>
                        ) : (
                          <>
                            <IconLogout className="h-4 w-4 mr-2" />
                            Log Out
                          </>
                        )}
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full"
                      >
                        <IconTrash className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Notifications</h2>

                  {/* Notification Preferences */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">General Preferences</h3>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconBell className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">In-App Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive notifications within the application</p>
                          </div>
                        </div>
                        <Switch
                          checked={inAppNotifications}
                          onCheckedChange={(checked) => {
                            setInAppNotifications(checked)
                            saveNotificationPreferences({ inApp: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                          <IconMail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Email Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                          </div>
                        </div>
                        <Switch
                          checked={emailNotifications}
                          onCheckedChange={(checked) => {
                            setEmailNotifications(checked)
                            saveNotificationPreferences({ email: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-6 space-y-4">
                      <h3 className="text-lg font-semibold">Notification Types</h3>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Login Notifications</p>
                            <p className="text-sm text-muted-foreground">Get notified when someone logs into your account</p>
                          </div>
                        </div>
                        <Switch
                          checked={loginNotifications}
                          onCheckedChange={(checked) => {
                            setLoginNotifications(checked)
                            saveNotificationPreferences({ login: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                          <IconUserCog className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">File Sharing Notifications</p>
                            <p className="text-sm text-muted-foreground">Get notified when files are shared with you</p>
                          </div>
                        </div>
                        <Switch
                          checked={fileShareNotifications}
                          onCheckedChange={(checked) => {
                            setFileShareNotifications(checked)
                            saveNotificationPreferences({ fileShare: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                          <IconGift className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Billing Notifications</p>
                            <p className="text-sm text-muted-foreground">Get notified about billing and payment updates</p>
                          </div>
                        </div>
                        <Switch
                          checked={billingNotifications}
                          onCheckedChange={(checked) => {
                            setBillingNotifications(checked)
                            saveNotificationPreferences({ billing: checked })
                          }}
                          disabled={isLoadingNotificationPrefs}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "referrals" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Referral Program</h2>

                  {/* Referral Info Banner */}
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <IconGift className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-green-900 dark:text-green-100">Earn Free Storage</h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Invite friends and get 500MB of storage for each friend who signs up, verifies their email, and uploads a file. Maximum 10GB bonus (20 referrals).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 space-y-4">

                    {/* Referral Code Section */}
                    {isLoadingReferrals ? (
                      <div className="flex justify-center py-6">
                        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">Your Referral Code</Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-muted rounded font-mono text-sm border border-border">
                              {referralCode}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCopyReferralCode}
                              className="px-3"
                            >
                              {copiedCode ? (
                                <IconCheckmark className="h-4 w-4" />
                              ) : (
                                <IconCopy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Referral Link Section */}
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">Your Referral Link</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={referralLink}
                              readOnly
                              className="flex-1 p-2 text-sm bg-muted rounded border border-border text-muted-foreground truncate"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCopyReferralLink}
                              className="px-3"
                            >
                              {copiedLink ? (
                                <IconCheckmark className="h-4 w-4" />
                              ) : (
                                <IconCopy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Referral Stats - Now showing in the title */}

                        {/* Recent Referrals Table */}
                        {recentReferrals && recentReferrals.length > 0 && (
                          <div className="border-t pt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold">Referral History ({formatStorageSize((referralStats?.totalEarningsMB || 0) * 1024 * 1024)} of 10GB free space earned)</h3>
                              {referralsTotal > 5 && (
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/40 rounded-full border border-border/50 shadow-sm transition-all hover:bg-muted/60">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-full hover:bg-background shadow-xs transition-transform active:scale-95"
                                    onClick={() => loadReferralData(referralsPage - 1)}
                                    disabled={referralsPage === 1}
                                  >
                                    <IconChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <div className="flex items-center gap-1 min-w-[3rem] justify-center">
                                    <span className="text-[11px] font-bold text-foreground tabular-nums">{referralsPage}</span>
                                    <span className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-tight">/</span>
                                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{Math.ceil(referralsTotal / 5)}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-full hover:bg-background shadow-xs transition-transform active:scale-95"
                                    onClick={() => loadReferralData(referralsPage + 1)}
                                    disabled={referralsPage >= Math.ceil(referralsTotal / 5)}
                                  >
                                    <IconChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm font-mono">
                                <thead className="bg-muted/50 border-b">
                                  <tr>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">User</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px] hidden sm:table-cell">Email</th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Status</th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px] hidden xs:table-cell">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {recentReferrals.map((referral) => (
                                    <tr key={referral.referred_user_id} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-4 py-3 min-w-[160px]">
                                        <div className="flex items-center gap-3">
                                          <Avatar className="h-8 w-8 flex-shrink-0">
                                            <AvatarImage
                                              src={referral.avatar_url || getDiceBearAvatar(referral.referred_user_id, 32)}
                                              alt={`${referral.referred_name || getDisplayNameFromEmail(referral.referred_email)}'s avatar`}
                                              onError={(e) => {
                                                // Prevent favicon.ico fallback request
                                                (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                                              }}
                                            />
                                            <AvatarFallback className="text-xs">
                                              {getInitials(referral.referred_name || getDisplayNameFromEmail(referral.referred_email))}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{referral.referred_name || getDisplayNameFromEmail(referral.referred_email)}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 min-w-[160px] hidden sm:table-cell">
                                        <p className="text-xs text-muted-foreground truncate">{referral.referred_email}</p>
                                      </td>
                                      <td className="px-4 py-3 text-center min-w-[120px]">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${referral.status === 'completed'
                                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                          : referral.status === 'pending'
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                            : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                          }`}>
                                          {referral.status === 'completed' ? '✓ Completed' : referral.status === 'pending' ? '○ Pending' : 'Cancelled'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-center min-w-[120px] hidden xs:table-cell">
                                        <p className="text-xs text-muted-foreground">
                                          {referral.status === 'completed' && referral.completed_at
                                            ? formatTimeAgo(referral.completed_at)
                                            : formatTimeAgo(referral.created_at)}
                                        </p>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Empty Referrals State */}
                        {recentReferrals.length === 0 && !isLoadingReferrals && (
                          <div className="border-t pt-6">
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No referrals yet. Share your referral link to get started!
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Billing & Subscription</h2>

                  {/* Current Plan Section */}
                  {isLoadingBilling ? (
                    <div className="flex justify-center py-6">
                      <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <h3 className="font-medium mb-3">Current Plan</h3>
                          {subscription ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Plan:</span>
                                <span className="font-medium">{subscription.plan?.name || 'Unknown Plan'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status:</span>
                                <span className={`text-sm font-medium px-2 py-1 rounded-full ${subscription.status === 'active'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : subscription.status === 'trialing'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : subscription.status === 'past_due'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                  }`}>
                                  {subscription.status === 'active' ? 'Active' :
                                    subscription.status === 'trialing' ? 'Trial' :
                                      subscription.status === 'past_due' ? 'Past Due' :
                                        subscription.status || 'Unknown'}
                                </span>
                              </div>
                              {subscription.cancelAtPeriodEnd && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Cancellation:</span>
                                  <span className="text-sm text-red-600 font-medium">
                                    {subscription.currentPeriodEnd
                                      ? `Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                                      : 'Scheduled for cancellation'
                                    }
                                  </span>
                                </div>
                              )}
                              {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Next billing:</span>
                                  <span className="text-sm font-medium">
                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {subscription.plan?.interval && subscription.plan.interval !== 0 && subscription.plan.interval !== '0' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Billing cycle:</span>
                                  <span className="text-sm font-medium capitalize">
                                    {subscription.plan.interval}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Plan:</span>
                                <span className="font-medium">Free Plan</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status:</span>
                                <span className={`text-sm font-medium px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>
                                  Active
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Storage:</span>
                                <span className="text-sm font-medium">5GB included</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Storage Usage */}
                        {billingUsage && (
                          <div className="p-4 border rounded-lg">
                            <h3 className="font-medium mb-2">Storage Usage</h3>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Used:</span>
                                <span className="font-medium">{formatStorageSize(billingUsage.usedBytes)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Limit:</span>
                                <span className="font-medium">{formatStorageSize(billingUsage.quotaBytes)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${billingUsage.percentUsed > 90
                                    ? 'bg-red-500'
                                    : billingUsage.percentUsed > 75
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                    }`}
                                  style={{ width: `${Math.min(billingUsage.percentUsed, 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-muted-foreground text-center">
                                {billingUsage.percentUsed.toFixed(1)}% used
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          {subscription && !subscription.cancelAtPeriodEnd ? (
                            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  disabled={isCancellingSubscription}
                                  className="flex-1"
                                >
                                  Cancel Subscription
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel your subscription?
                                    <br /><br />
                                    • You will retain access to your current plan until the end of your billing period
                                    <br />
                                    • No future charges will be made
                                    <br />
                                    • You can reactivate your subscription at any time before it expires
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleCancelSubscription}
                                    disabled={isCancellingSubscription}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {isCancellingSubscription ? (
                                      <>
                                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                        Cancelling...
                                      </>
                                    ) : (
                                      'Cancel Subscription'
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : subscription?.cancelAtPeriodEnd ? (
                            <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                                Subscription will be cancelled on {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString() : 'the end of billing period'}
                              </p>
                            </div>
                          ) : null}

                          <Button
                            variant="outline"
                            onClick={handleManageSubscription}
                            disabled={isRedirectingToPortal}
                            className="flex-1"
                          >
                            {isRedirectingToPortal ? (
                              <>
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                Redirecting...
                              </>
                            ) : (
                              'Customer Portal'
                            )}
                          </Button>
                          <Button
                            onClick={() => window.location.href = '/billing'}
                            className="flex-1"
                          >
                            {subscription ? 'Change Plan' : 'Upgrade Plan'}
                          </Button>
                        </div>

                        {/* Important Information */}
                        {subscription && !subscription.cancelAtPeriodEnd && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                              <IconInfoCircle className="w-4 h-4" />
                              Important Information
                            </h4>
                            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                              <li>• You cannot cancel your subscription if you&apos;re using more than 5GB of storage</li>
                              <li>• When cancelled, you&apos;ll keep access until the end of your billing period</li>
                              <li>• No future charges will be made after cancellation</li>
                              <li>• You can reactivate your subscription at any time before it expires</li>
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Subscription History */}
                      <div className="border-t pt-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Billing History</h3>
                          {subscriptionHistory && (subscriptionHistory.history?.length > 0 || subscriptionHistory.invoices?.length > 0) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadSubscriptionHistory()}
                              disabled={isLoadingHistory}
                            >
                              {isLoadingHistory ? (
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <IconRefresh className="h-4 w-4 mr-2" />
                              )}
                              Refresh
                            </Button>
                          )}
                        </div>

                        {isLoadingHistory ? (
                          <div className="flex justify-center py-6">
                            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : subscriptionHistory ? (
                          <>
                            {/* Subscription History Table */}
                            {subscriptionHistory.history && subscriptionHistory.history.length > 0 && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-muted-foreground">Subscriptions</h4>
                                  {subsTotalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage - 1, invoicesPage)}
                                        disabled={subsPage === 1}
                                      >
                                        <IconChevronLeft className="h-4 w-4" />
                                      </Button>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {subsPage} / {subsTotalPages}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage + 1, invoicesPage)}
                                        disabled={subsPage >= subsTotalPages}
                                      >
                                        <IconChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-card max-h-80">
                                  <div className="overflow-x-auto overflow-y-auto h-full">
                                    <table className="w-full text-sm font-mono">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Plan</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Status</th>
                                          <th className="text-right px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Amount</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Billing</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Created</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {subscriptionHistory.history.map((sub: SubscriptionHistory['history'][0]) => (
                                          <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 min-w-[160px]">
                                              <div>
                                                <p className="font-medium">{sub.planName}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{sub.interval}ly</p>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${sub.status === 'active'
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : sub.status === 'canceled'
                                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                  : sub.status === 'past_due'
                                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                    : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                                }`}>
                                                {sub.status === 'active' ? 'Active' :
                                                  sub.status === 'canceled' ? 'Cancelled' :
                                                    sub.status === 'past_due' ? 'Past Due' :
                                                      sub.status}
                                                {sub.cancelAtPeriodEnd && ' (Cancelling)'}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-right min-w-[120px]">
                                              <p className="font-medium">${sub.amount.toFixed(2)}</p>
                                              <p className="text-xs text-muted-foreground">{sub.currency.toUpperCase()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <p className="text-xs capitalize">{sub.interval}ly</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <p className="text-xs">{new Date(sub.created * 1000).toLocaleDateString()}</p>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Invoices Table */}
                            {subscriptionHistory.invoices && subscriptionHistory.invoices.length > 0 && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-muted-foreground">Invoices</h4>
                                  {invoicesTotalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage, invoicesPage - 1)}
                                        disabled={invoicesPage === 1}
                                      >
                                        <IconChevronLeft className="h-4 w-4" />
                                      </Button>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {invoicesPage} / {invoicesTotalPages}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => loadSubscriptionHistory(subsPage, invoicesPage + 1)}
                                        disabled={invoicesPage >= invoicesTotalPages}
                                      >
                                        <IconChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-card max-h-80">
                                  <div className="overflow-x-auto overflow-y-auto h-full">
                                    <table className="w-full text-sm font-mono">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Invoice</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Status</th>
                                          <th className="text-right px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Amount</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Date</th>
                                          <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px]">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {subscriptionHistory.invoices.map((invoice: SubscriptionHistory['invoices'][0]) => (
                                          <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 min-w-[160px]">
                                              <div>
                                                <p className="font-medium">{invoice.number || `Invoice ${invoice.id.slice(-8)}`}</p>
                                                {invoice.subscriptionId && (
                                                  <p className="text-xs text-muted-foreground">Sub: {invoice.subscriptionId.slice(-8)}</p>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${invoice.status === 'paid'
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : invoice.status === 'open'
                                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                  : invoice.status === 'void'
                                                    ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                }`}>
                                                {invoice.status === 'paid' ? 'Paid' :
                                                  invoice.status === 'open' ? 'Open' :
                                                    invoice.status === 'void' ? 'Void' :
                                                      invoice.status}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-right min-w-[120px]">
                                              <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                                              <p className="text-xs text-muted-foreground">{invoice.currency.toUpperCase()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <p className="text-xs">{new Date(invoice.created * 1000).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center min-w-[120px]">
                                              <div className="flex gap-2 justify-center">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => window.open(invoice.invoicePdf, '_blank')}
                                                  className="text-xs"
                                                >
                                                  Download
                                                </Button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Empty State */}
                            {(!subscriptionHistory.history || subscriptionHistory.history.length === 0) &&
                              (!subscriptionHistory.invoices || subscriptionHistory.invoices.length === 0) && (
                                <div className="text-center py-12">
                                  <h3 className="text-sm font-medium text-foreground mb-1">No billing history yet</h3>
                                  <p className="text-sm text-muted-foreground">Your invoices and subscription details will appear here</p>
                                </div>
                              )}
                          </>
                        ) : (
                          <div className="text-center py-12">
                            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                              <IconLoader2 className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-1">Unable to load billing history</h3>
                            <p className="text-sm text-muted-foreground mb-4">Please try again or contact support if the issue persists</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadSubscriptionHistory()}
                            >
                              Try Again
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </main>
        </SidebarProvider>

        {/* Email Change Modal */}
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Email Address</DialogTitle>
              <DialogDescription>
                Update your email address. You&apos;ll need to verify with your password and confirm the new email via OTP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="modal-new-email">New Email</Label>
                <Input
                  id="modal-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter your new email address"
                  disabled={isChangingEmail}
                />
              </div>
              <div>
                <Label htmlFor="modal-confirm-email">Confirm New Email</Label>
                <Input
                  id="modal-confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Confirm your new email address"
                  disabled={isChangingEmail}
                />
              </div>
              <div>
                <Label htmlFor="modal-email-password">Current Password</Label>
                <PasswordInput
                  id="modal-email-password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Enter your current password to verify"
                  disabled={isChangingEmail}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your password will be validated client-side only
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEmailModal(false)
                setNewEmail("")
                setConfirmEmail("")
                setEmailPassword("")
              }} disabled={isChangingEmail}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!newEmail.trim() || !confirmEmail.trim() || !emailPassword.trim()) {
                    toast.error("All fields are required")
                    return
                  }
                  if (newEmail !== confirmEmail) {
                    toast.error("Email addresses do not match")
                    return
                  }
                  if (newEmail === user?.email) {
                    toast.error("New email must be different from current email")
                    return
                  }

                  setIsChangingEmail(true)
                  try {
                    // Step 1: Validate password client-side using OPAQUE
                    // We'll try to complete a login flow to verify the password is correct
                    const { OPAQUELogin } = await import("@/lib/opaque")
                    const passwordVerifier = new OPAQUELogin()

                    try {
                      // Start the login process to validate password
                      const { startLoginRequest } = await passwordVerifier.step1(emailPassword.trim())
                      // Get the login response from server
                      const { loginResponse } = await passwordVerifier.step2(user?.email || "", startLoginRequest)
                      // Finish login locally to verify password
                      const result = await passwordVerifier.step3(loginResponse)

                      if (!result) {
                        toast.error("Invalid password")
                        setIsChangingEmail(false)
                        return
                      }

                      console.log("Password validated successfully")
                    } catch (passwordError: unknown) {
                      const errorMsg = passwordError instanceof Error ? passwordError.message : "Password validation failed"
                      console.error('Password validation error:', errorMsg)
                      toast.error("Invalid password. Please try again.")
                      setIsChangingEmail(false)
                      return
                    }

                    // Step 2: Password is valid, now initiate email change (send OTP)
                    const initiateResponse = await apiClient.initiateEmailChange(newEmail.trim())

                    if (!initiateResponse.success) {
                      toast.error(initiateResponse.error || "Failed to initiate email change")
                      setIsChangingEmail(false)
                      return
                    }

                    // Step 3: Store the email change token and new email for OTP verification
                    const emailChangeToken = initiateResponse.data?.emailChangeToken
                    if (emailChangeToken) {
                      sessionStorage.setItem('emailChangeToken', emailChangeToken)
                      sessionStorage.setItem('newEmail', newEmail.trim())
                    }

                    toast.success("OTP sent to your new email address")

                    // Clear the form and open OTP verification modal
                    setShowEmailModal(false)
                    setNewEmail("")
                    setConfirmEmail("")
                    setEmailPassword("")
                    setEmailOTPCode("")
                    setShowEmailOTPModal(true)

                  } catch (error) {
                    console.error('Email change error:', error)
                    toast.error("Failed to initiate email change")
                  } finally {
                    setIsChangingEmail(false)
                  }
                }}
                disabled={isChangingEmail}
              >
                {isChangingEmail ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Validating...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email Change OTP Verification Modal */}
        <Dialog open={showEmailOTPModal} onOpenChange={setShowEmailOTPModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Verify New Email</DialogTitle>
              <DialogDescription>
                Enter the verification code sent to your new email address
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email-otp-code">Verification Code</Label>
                <Input
                  id="email-otp-code"
                  type="text"
                  value={emailOTPCode}
                  onChange={(e) => setEmailOTPCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  disabled={isVerifyingEmailOTP || isResendingEmailOTP}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailOTPCode.length === 6) {
                      handleVerifyEmailOTP()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Check your new email for the verification code
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={handleResendEmailOTP}
                disabled={isResendingEmailOTP || isVerifyingEmailOTP}
              >
                {isResendingEmailOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Resending...
                  </>
                ) : (
                  "Resend Code"
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEmailOTPModal(false)
                setEmailOTPCode("")
              }} disabled={isVerifyingEmailOTP || isResendingEmailOTP}>
                Cancel
              </Button>
              <Button
                onClick={handleVerifyEmailOTP}
                disabled={isVerifyingEmailOTP || isResendingEmailOTP || emailOTPCode.length !== 6}
              >
                {isVerifyingEmailOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Change Modal - Now just shows explanation and options */}
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Password Reset Required</DialogTitle>
              <DialogDescription>
                Password changes require your mnemonic backup
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <h3 className="font-medium text-foreground mb-2">
                  Account Recovery System
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Password changes are secured with your mnemonic backup from registration. To reset your password, visit the dedicated reset page.
                </p>
                <div className="bg-background border border-border rounded p-3 text-xs text-foreground space-y-2 mb-3">
                  <p><strong>If you have your mnemonic:</strong></p>
                  <p>✓ Proceed to reset page and use your backup to change your password</p>
                  <p className="pt-2"><strong>If you lost your mnemonic:</strong></p>
                  <p>✗ Unfortunately, you cannot reset your password directly</p>
                  <p>✗ You must create a new account and manually migrate your data</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setIsChangingPassword(true)
                  try {
                    // Reset form
                    setShowPasswordModal(false)

                    // Log out and redirect to reset page
                    await completeLogout()
                    window.location.href = '/reset'
                  } catch (error) {
                    console.error('Password reset redirect error:', error)
                    toast.error("Failed to redirect to password reset page")
                    setIsChangingPassword(false)
                  }
                }}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Redirecting...
                  </>
                ) : (
                  "Go to Reset Page"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Account Deletion Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">Permanently Delete Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1 max-w-full overflow-hidden">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Why are you leaving? (Optional)
                  </Label>
                  <Select value={deleteReason} onValueChange={setDeleteReason}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Too expensive">Too expensive</SelectItem>
                      <SelectItem value="Better alternative">Found a better alternative</SelectItem>
                      <SelectItem value="Not using">Not using</SelectItem>
                      <SelectItem value="Too New">Product is too new</SelectItem>
                      <SelectItem value="Not enough storage">Not enough storage</SelectItem>
                      <SelectItem value="Security concerns">Security concerns</SelectItem>
                      <SelectItem value="Technical issues">Technical issues</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider break-words">
                      Additional feedback (Optional)
                    </Label>
                    <span className={`text-[10px] flex-shrink-0 ml-2 ${deleteDetails.length > 900 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      {deleteDetails.length} / 1000
                    </span>
                  </div>
                  <Textarea
                    value={deleteDetails}
                    onChange={(e) => setDeleteDetails(e.target.value.substring(0, 1000))}
                    placeholder="Tell us more about your experience..."
                    className="h-28 overflow-y-auto break-words resize-none w-full"
                    style={{ fieldSizing: 'fixed' } as React.CSSProperties}
                  />
                </div>
              </div>

              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg w-full">
                <p className="text-sm font-medium text-destructive mb-2">
                  Type &quot;DELETE&quot; to confirm
                </p>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="font-mono bg-background/50 border-destructive/20 focus-visible:ring-destructive w-full"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowDeleteModal(false)
                setDeleteConfirmation("")
              }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmation !== "DELETE"}
              >
                {isDeletingAccount ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* TOTP Setup Modal */}
        <Dialog open={showTOTPSetup} onOpenChange={setShowTOTPSetup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Scan the QR code with your authenticator app, then enter the 6-digit code to enable TOTP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {totpQrCode && (
                <div className="flex justify-center">
                  <Image
                    src={totpQrCode}
                    alt="TOTP QR Code"
                    width={200}
                    height={200}
                    className="max-w-full h-auto"
                  />
                </div>
              )}
              {totpSecret && (
                <div className="space-y-2">
                  <Label>Manual Entry Code</Label>
                  <code className="block p-2 bg-muted rounded font-mono text-sm break-all">
                    {totpSecret}
                  </code>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="setup-totp-token">Enter 6-digit code</Label>
                <Input
                  id="setup-totp-token"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowTOTPSetup(false)
                setTotpSecret("")
                setTotpUri("")
                setTotpQrCode("")
                setTotpToken("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleTOTPVerify}
                disabled={isVerifyingTOTP || totpToken.length !== 6}
              >
                {isVerifyingTOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Enable TOTP"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* TOTP Disable Modal */}
        <Dialog open={showTOTPDisable} onOpenChange={setShowTOTPDisable}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Enter your 6-digit authenticator code or a recovery code to disable TOTP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disable-totp-token">6-digit Authenticator Code</Label>
                <Input
                  id="disable-totp-token"
                  value={disableToken}
                  onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg font-mono"
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">OR</div>
              <div className="space-y-2">
                <Label htmlFor="disable-recovery-code">Recovery Code</Label>
                <Input
                  id="disable-recovery-code"
                  value={disableRecoveryCode}
                  onChange={(e) => setDisableRecoveryCode(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  className="text-center text-lg font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTOTPDisable(false)
                  setDisableToken("")
                  setDisableRecoveryCode("")
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleTOTPDisable}
                disabled={isDisablingTOTP || (!disableToken && !disableRecoveryCode)}
              >
                {isDisablingTOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Disabling...
                  </>
                ) : (
                  "Disable TOTP"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email OTP Verification Modal */}
        <Dialog open={showEmailOTPModal} onOpenChange={setShowEmailOTPModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Verify Your New Email</DialogTitle>
              <DialogDescription>
                We&apos;ve sent a 6-digit code to your new email address. Please enter it to complete the email change.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Check your inbox:</strong> {sessionStorage.getItem('newEmail')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-otp-code">Verification Code</Label>
                <Input
                  id="email-otp-code"
                  type="text"
                  value={emailOTPCode}
                  onChange={(e) => setEmailOTPCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg font-mono tracking-widest"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Code expires in 15 minutes
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailOTPModal(false)
                  setEmailOTPCode("")
                  sessionStorage.removeItem('emailChangeToken')
                  sessionStorage.removeItem('newEmail')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyEmailOTP}
                disabled={isVerifyingEmailOTP || emailOTPCode.length !== 6}
              >
                {isVerifyingEmailOTP ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recovery Codes Modal */}
        <Dialog open={showRecoveryCodesModal} onOpenChange={setShowRecoveryCodesModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Your Recovery Codes</DialogTitle>
              <DialogDescription>
                These codes can be used to access your account if you lose your authenticator device. Keep them safe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Important:</strong> Each code can only be used once. Store these codes securely and treat them like passwords.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {recoveryCodes.map((code, index) => (
                  <code key={index} className="block p-2 bg-muted rounded font-mono text-sm text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  // Download recovery codes
                  const codesText = recoveryCodes.join('\n')
                  const blob = new Blob([codesText], { type: 'text/plain' })
                  const unixTimestamp = Math.floor(Date.now() / 1000)
                  const randomHex = Math.random().toString(16).slice(2, 8) // Random hex for uniqueness
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `recovery-codes-${randomHex}-${unixTimestamp}.txt`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                  setShowRecoveryCodesModal(false)
                  setRecoveryCodes([])
                }}
              >
                Download Codes
              </Button>
              <Button
                onClick={() => {
                  setShowRecoveryCodesModal(false)
                  setRecoveryCodes([])
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancellation Reason Dialog */}
        <Dialog open={showCancelReasonDialog} onOpenChange={setShowCancelReasonDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Help us improve</DialogTitle>
              <DialogDescription>
                Your subscription has been cancelled. Your feedback helps us improve our service.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Cancellation Reason</Label>
                <div className="space-y-2">
                  {[
                    { value: 'too_expensive', label: 'Too expensive' },
                    { value: 'not_enough_storage', label: 'Not enough storage' },
                    { value: 'switching_services', label: 'Switching to another service' },
                    { value: 'not_using_features', label: 'Not using the features' },
                    { value: 'performance_issues', label: 'Performance issues' },
                    { value: 'other', label: 'Other' }
                  ].map((option) => (
                    <div key={option.value} className="flex items-center">
                      <input
                        id={`reason-${option.value}`}
                        type="radio"
                        name="cancelReason"
                        value={option.value}
                        checked={cancelReason === option.value}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`reason-${option.value}`} className="ml-3 block text-sm font-medium">
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {cancelReason && (
                <div className="space-y-2">
                  <Label htmlFor="reason-details" className="text-sm font-medium">
                    Additional Details (Optional)
                  </Label>
                  <textarea
                    id="reason-details"
                    value={cancelReasonDetails}
                    onChange={(e) => setCancelReasonDetails(e.target.value)}
                    placeholder="Help us understand better..."
                    className="w-full h-24 p-2 border border-input rounded-md bg-background text-foreground resize-none text-sm"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelReasonDialog(false)
                  setCancelReason("")
                  setCancelReasonDetails("")
                }}
              >
                Skip Feedback
              </Button>
              <Button
                onClick={handleConfirmCancelSubscription}
                disabled={isCancellingSubscription || !cancelReason.trim()}
              >
                {isCancellingSubscription ? (
                  <>
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
          disabled={isLoadingAvatar}
        />
      </DialogContent>
    </Dialog>
  )
}