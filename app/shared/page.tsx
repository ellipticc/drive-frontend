"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { SharesTable } from "@/components/tables/shares-table"
import { Separator } from "@/components/ui/separator"
import { SiteHeader } from "@/components/layout/header/site-header"
import { useGlobalUpload } from "@/components/global-upload-context"
import { useEffect, useState } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"

export default function SharedPage() {
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
      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col h-full space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("sidebar.shared")}</h2>
            </div>
          </div>
          <Separator />
          <div className="flex-1 overflow-auto -mx-8 px-8">
            <SharesTable mode="sent" />
          </div>
        </div>
      </main>
    </div>
  )
}