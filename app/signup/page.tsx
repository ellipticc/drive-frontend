import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"

import { ThemeToggle } from "@/components/theme-toggle"
import { SignupFormAuth } from "@/components/auth/signup-form-auth"

export const metadata: Metadata = {
  title: "Register - Ellipticc Drive",
}

export default function SignupPage() {
  return (
    <div className="grid h-svh lg:grid-cols-[55fr_45fr] overflow-hidden">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between lg:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium lg:hidden">
            <IconCaretLeftRightFilled className="!size-5" />
            <span className="text-base font-mono break-all">ellipticc</span>
          </a>
          <ThemeToggle className="lg:hidden" />
          <ThemeToggle className="hidden lg:flex" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupFormAuth />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block overflow-hidden">
        <img
          src="/register.png"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  )
}
