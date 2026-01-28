import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import type { Metadata } from "next"
import Image from "next/image"
import { Suspense } from "react"

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
            <span className="text-base font-geist-mono select-none break-all">ellipticc</span>
          </a>
          <ThemeToggle className="lg:hidden" />
          <ThemeToggle className="hidden lg:flex" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Suspense fallback={<div />}>
              <SignupFormAuth />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block overflow-hidden">
        <Image
          src="/register.png"
          alt="Ellipticc Drive Signup"
          fill
          className="object-cover object-center"
          priority
          quality={100}
          sizes="(max-width: 1024px) 0vw, 45vw"
        />
      </div>
    </div>
  )
}
