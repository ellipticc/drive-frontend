import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"

import { ThemeToggle } from "@/components/theme-toggle"
import { LoginFormAuth } from "@/components/auth/login-form-auth"

export const metadata: Metadata = {
  title: "Login - Ellipticc Drive",
}

export default function LoginPage() {
  return (
    <div className="grid h-svh lg:grid-cols-[45fr_55fr] overflow-hidden">
      {/* Image on left side */}
      <div className="bg-muted relative hidden lg:block overflow-hidden">
        <img
          src="/login.png"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {/* Form on right side */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between lg:justify-end">
          <ThemeToggle className="lg:hidden" />
          <a href="#" className="flex items-center gap-2 font-medium lg:hidden">
            <IconCaretLeftRightFilled className="!size-5" />
            <span className="text-base font-mono break-all">ellipticc</span>
          </a>
          <ThemeToggle className="hidden lg:flex" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginFormAuth />
          </div>
        </div>
      </div>
    </div>
  )
}
