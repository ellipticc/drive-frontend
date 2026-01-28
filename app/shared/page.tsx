"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { SharesTable } from "@/components/tables/shares-table"
import { Separator } from "@/components/ui/separator"
import { SiteHeader } from "@/components/layout/header/site-header"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useEffect, useState, Suspense } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"

function SharedPageContent() {
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")
  const { handleFileUpload, handleFolderUpload } = useGlobalUpload()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Sync search param from URL
  useEffect(() => {
    const q = searchParams.get('q');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery(q || "");
  }, [searchParams]);

  return (
    <div className="flex w-full flex-col">
      <SiteHeader
        onSearch={handleSearch}
        searchValue={searchQuery}
        onFileUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
        sticky />
      <main className="flex-1">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SharesTable mode="sent" searchQuery={searchQuery} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SharedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-svh" />}>
      <SharedPageContent />
    </Suspense>
  )
}