"use client"

import { useState, useLayoutEffect, useEffect, useRef } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer, Line, LineChart, ComposedChart } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"
import { IconLoader2, IconHelpCircle, IconTrendingUp, IconFiles, IconHistory, IconRuler, IconDatabase, IconTrash, IconChartBar, IconFile, IconPhoto, IconVideo, IconMusic, IconFileText, IconRefresh, IconDownload, IconInfoCircle, IconCalendar as CalendarIcon, IconX, IconChevronLeft, IconChevronRight, IconArrowUp, IconArrowDown, IconSparkles } from "@tabler/icons-react"
import { format } from "date-fns"
import { masterKeyManager } from "@/lib/master-key"
import { decryptFilename } from "@/lib/crypto"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatFileSize, cn } from "@/lib/utils"
import { InsightsDataTable } from "@/components/tables/insights-table"
import { useGlobalUpload } from "@/components/global-upload-context"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DateRange } from "react-day-picker"

const chartConfig = {
  storage: {
    label: "Storage",
    color: "hsl(var(--chart-1))",
  },
  files: {
    label: "Files",
    color: "hsl(var(--chart-2))",
  },
  uploads: {
    label: "Uploads",
    color: "hsl(var(--chart-3))",
  },
  size: {
    label: "Size",
    color: "hsl(var(--chart-4))",
  },
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return <IconPhoto className="h-5 w-5 text-blue-500" />
  if (mimeType.startsWith('video/')) return <IconVideo className="h-5 w-5 text-purple-500" />
  if (mimeType.startsWith('audio/')) return <IconMusic className="h-5 w-5 text-green-500" />
  if (mimeType === 'application/pdf') return <IconFileText className="h-5 w-5 text-red-500" />
  return <IconFile className="h-5 w-5 text-gray-500" />
}

export default function InsightsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [timeRange, setTimeRange] = useState("30d")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [decryptedTopFiles, setDecryptedTopFiles] = useState<any[]>([])

  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [logsPagination, setLogsPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [totalPages, setTotalPages] = useState(0)
  const [totalLogs, setTotalLogs] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showWipeDialog, setShowWipeDialog] = useState(false)
  const [activityEventType, setActivityEventType] = useState<string>('')
  
  const [upgradeDialogData, setUpgradeDialogData] = useState<{ open: boolean; title: string; description: string } | null>(null)

  const { startUploadWithFiles, startUploadWithFolders } = useGlobalUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFolderUpload = () => {
    folderInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      startUploadWithFiles(Array.from(e.target.files), null) // null for root/default context
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      startUploadWithFolders(e.target.files, null)
    }
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  // Set page title
  useLayoutEffect(() => {
    document.title = "Insights - Ellipticc Drive"
  }, [])

  const fetchLogsOnly = async () => {
    try {
      const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined
      const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined

      const logsResponse = await apiClient.getActivityLogsInsights(
        logsPagination.pageIndex + 1,
        logsPagination.pageSize,
        startDate,
        endDate,
        activityEventType || undefined
      )
      if (logsResponse.success && logsResponse.data) {
        setActivityLogs(logsResponse.data.activity)
        setTotalPages(logsResponse.data.pagination.totalPages)
        setTotalLogs(logsResponse.data.pagination.total)
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchLogsOnly()
    // Small delay for smoothness
    setTimeout(() => setIsRefreshing(false), 600)
  }

  const handleExport = async () => {
    const plan = analytics?.overview?.plan || 'free';
    if (plan !== 'pro' && plan !== 'unlimited') {
      setUpgradeDialogData({ open: true, title: 'Export is a premium feature', description: 'Exporting activity logs is available on Pro & Unlimited plans.' });
      return;
    }

    setIsExporting(true)
    try {
      await apiClient.exportActivityLogsInsights()
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleWipe = () => {
    setShowWipeDialog(true)
  }

  const confirmWipe = async () => {
    try {
      await apiClient.wipeActivityLogsInsights()
      fetchLogsOnly()
      setShowWipeDialog(false)
      setActivityLogs([]) // Clear local state immediately for responsiveness
    } catch (error) {
      console.error("Wipe failed:", error)
    }
  }

  // Fetch analytics data (Overview)
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true)
      try {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
        const response = await apiClient.getDashboardInsights(days)

        if (response.success && response.data) {
          const data = response.data as any
          setAnalytics(data)

          // Decrypt top files
          if (data.topFiles) {
            const masterKey = masterKeyManager.getMasterKey();
            const decrypted = await Promise.all(data.topFiles.map(async (file: any) => {
              let name = file.name;
              if (masterKey && file.encryptedName && file.nameSalt) {
                try {
                  name = await decryptFilename(file.encryptedName, file.nameSalt, masterKey);
                } catch (e) {
                  // Keep encrypted name if decryption fails
                }
              }
              return { ...file, name };
            }));
            setDecryptedTopFiles(decrypted);
          }
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [timeRange])

  // Fetch activity logs (Pagination or Date Filter or Event Type change)
  useEffect(() => {
    fetchLogsOnly()
  }, [logsPagination.pageIndex, logsPagination.pageSize, dateRange, activityEventType])

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <SiteHeader onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} sticky />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full flex flex-col gap-6">
            <div className="h-16 w-full max-w-sm rounded-lg bg-muted/20 animate-pulse" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <SiteHeader onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} sticky />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full flex items-center justify-center h-full">
            <p className="text-muted-foreground">Failed to load analytics data</p>
          </div>
        </main>
      </div>
    )
  }

  const { overview, storageOverTime, fileTypeBreakdown, recentActivity, monthlyGrowth } = analytics

  // Get time range label
  const timeRangeLabel = timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : "3 months"

  // Format charts data
  const storageChartData = storageOverTime.map((item: any) => ({
    date: item.date,
    storage: parseFloat((item.storage / (1024 * 1024)).toFixed(2)), // Convert to MB
    files: item.files
  }))

  const activityChartData = recentActivity.map((item: any) => ({
    date: item.date,
    uploads: item.uploads,
    size: parseFloat((item.uploaded_size / (1024 * 1024)).toFixed(2)) // Convert to MB
  }))

  const growthChartData = monthlyGrowth.map((item: any) => ({
    month: item.month,
    storage: parseFloat((item.storage / (1024 * 1024)).toFixed(2)), // Convert to MB
    files: item.files
  }))

  const typeChartData = fileTypeBreakdown.map((item: any) => ({
    name: item.type,
    value: item.count,
    size: item.size
  }))

  return (
    <div className="flex min-h-screen w-full flex-col">
      <SiteHeader onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} sticky />

      {/* Hidden file/folder inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderSelect}
        // @ts-ignore - webkitdirectory is not in standard types but works in most browsers
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      <main className="flex-1 py-8 bg-gradient-to-b from-background via-background to-muted/20">
        <div className="w-full space-y-8">
          {/* Page Header with Gradient */}
          <div className="relative px-4 lg:px-6">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-3xl blur-3xl -z-10" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight flex items-center gap-3 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  <IconSparkles className="h-10 w-10 text-primary animate-pulse" />
                  <span>Insights Dashboard</span>
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg font-medium">
                  Monitor your storage, activity, and security at a glance
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[140px] sm:w-[180px] h-11 rounded-2xl border-0 ring-1 ring-border/50 bg-background/80 backdrop-blur-sm shadow-lg hover:ring-primary/50 hover:shadow-primary/20 transition-all font-semibold">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="7d" className="rounded-xl font-medium">Last 7 days</SelectItem>
                    <SelectItem value="30d" className="rounded-xl font-medium">Last 30 days</SelectItem>
                    <SelectItem value="90d" className="rounded-xl font-medium">Last 3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {/* Stats Overview - Enhanced Design */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 px-4 lg:px-6">
              <Card className="group relative shadow-xl border-0 ring-1 ring-border/30 hover:ring-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl -z-0 group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Used Storage</CardDescription>
                    <IconDatabase className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {overview.totalStorageReadable}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="space-y-3">
                    <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden backdrop-blur-sm">
                      <div
                        className="h-full bg-gradient-to-r from-primary via-primary to-primary/80 transition-all duration-1000 ease-out rounded-full shadow-lg shadow-primary/50"
                        style={{ width: `${overview.percentUsed}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">{overview.percentUsed}% of {overview.quotaReadable}</span>
                      <div className="flex items-center gap-1 text-primary">
                        <IconTrendingUp className="h-3.5 w-3.5 animate-pulse" />
                        <span className="font-bold">Active</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group relative shadow-xl border-0 ring-1 ring-border/30 hover:ring-chart-2/40 hover:shadow-2xl hover:shadow-[hsl(var(--chart-2))]/10 transition-all duration-300 overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[hsl(var(--chart-2))]/20 to-transparent rounded-full blur-3xl -z-0 group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Files</CardDescription>
                    <IconFiles className="h-5 w-5 text-[hsl(var(--chart-2))]/60 group-hover:text-[hsl(var(--chart-2))] transition-colors" />
                  </div>
                  <CardTitle className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {overview.totalFiles.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-xs text-muted-foreground flex items-center gap-2 font-semibold">
                    <IconHistory className="h-4 w-4 text-[hsl(var(--chart-2))]/70" />
                    <span>{overview.totalVersions} versions saved</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="group relative shadow-xl border-0 ring-1 ring-border/30 hover:ring-chart-3/40 hover:shadow-2xl hover:shadow-[hsl(var(--chart-3))]/10 transition-all duration-300 overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[hsl(var(--chart-3))]/20 to-transparent rounded-full blur-3xl -z-0 group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trash Items</CardDescription>
                    <IconTrash className="h-5 w-5 text-[hsl(var(--chart-3))]/60 group-hover:text-[hsl(var(--chart-3))] transition-colors" />
                  </div>
                  <CardTitle className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {overview.deletedFiles.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Occupying <span className="text-[hsl(var(--chart-3))] font-bold">{formatFileSize(overview.deletedSize)}</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="group relative shadow-xl border-0 ring-1 ring-border/30 hover:ring-chart-4/40 hover:shadow-2xl hover:shadow-[hsl(var(--chart-4))]/10 transition-all duration-300 overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[hsl(var(--chart-4))]/20 to-transparent rounded-full blur-3xl -z-0 group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Storage Plan</CardDescription>
                    <IconRuler className="h-5 w-5 text-[hsl(var(--chart-4))]/60 group-hover:text-[hsl(var(--chart-4))] transition-colors" />
                  </div>
                  <CardTitle className="text-3xl sm:text-4xl font-black capitalize bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {overview.plan}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-xs text-muted-foreground flex items-center gap-2 font-semibold">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))] font-bold text-[10px]">
                      {overview.quotaReadable}
                    </span>
                    <span>total quota</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section - Beautiful Interactive Charts */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 px-4 lg:px-6">
              {/* Storage Usage Over Time - Interactive Area Chart */}
              <div className="lg:col-span-2">
                <Card className="h-full shadow-2xl border-0 ring-1 ring-border/30 hover:ring-primary/20 transition-all duration-300 rounded-3xl overflow-hidden backdrop-blur-sm bg-gradient-to-br from-background via-background to-muted/5">
                  <CardHeader className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl sm:text-2xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                          Storage Growth
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm font-medium">
                          Showing total storage for the last {timeRangeLabel}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 px-2 sm:px-6">
                    <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
                      <AreaChart data={storageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-storage)" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="var(--color-storage)" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-files)" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="var(--color-files)" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          minTickGap={32}
                          tickFormatter={(val) => format(new Date(val), "MMM d")}
                          className="text-xs font-medium"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tickFormatter={(val) => `${val} MB`}
                          className="text-xs font-medium"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <ChartTooltip
                          cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--primary))", strokeWidth: 1.5 }}
                          content={
                            <ChartTooltipContent
                              indicator="dot"
                              labelFormatter={(value) => {
                                return format(new Date(value), "MMM dd, yyyy")
                              }}
                            />
                          }
                        />
                        <Area
                          type="natural"
                          dataKey="storage"
                          stroke="var(--color-storage)"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorStorage)"
                          stackId="a"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              {/* File Type Breakdown - Donut Chart */}
              <Card className="shadow-2xl border-0 ring-1 ring-border/30 hover:ring-primary/20 transition-all duration-300 rounded-3xl overflow-hidden backdrop-blur-sm bg-gradient-to-br from-background via-background to-muted/5">
                <CardHeader className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                  <CardTitle className="text-xl sm:text-2xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Content Type
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium">
                    Distribution by file type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] flex items-center justify-center p-0">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {typeChartData.map((_entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={PIE_COLORS[index % PIE_COLORS.length]} 
                            className="hover:opacity-80 transition-opacity cursor-pointer stroke-background stroke-2"
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={(label) => label}
                          />
                        }
                      />
                      <ChartLegend 
                        content={<ChartLegendContent />} 
                        className="flex-wrap gap-2 text-sm"
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 px-4 lg:px-6">
              {/* Recent Activity Bar Chart */}
              <Card className="shadow-2xl border-0 ring-1 ring-border/30 hover:ring-primary/20 transition-all duration-300 rounded-3xl overflow-hidden backdrop-blur-sm bg-gradient-to-br from-background via-background to-muted/5">
                <CardHeader className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                  <CardTitle className="text-xl sm:text-2xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Creation Activity
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium">
                    New files and folders in the last {timeRangeLabel}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 h-[320px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-uploads)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--color-uploads)" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(val) => format(new Date(val), "MMM d")}
                        className="text-xs font-medium"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-xs font-medium"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent indicator="line" />}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.2, radius: 4 }}
                      />
                      <Bar 
                        dataKey="uploads" 
                        fill="url(#barGradient)"
                        radius={[8, 8, 0, 0]}
                        className="hover:opacity-80 transition-opacity"
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Monthly Growth Composed Chart */}
              <Card className="h-full shadow-2xl border-0 ring-1 ring-border/30 hover:ring-primary/20 transition-all duration-300 rounded-3xl overflow-hidden backdrop-blur-sm bg-gradient-to-br from-background via-background to-muted/5">
                <CardHeader className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                  <CardTitle className="text-xl sm:text-2xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Monthly Ingestion
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium">
                    Storage added over the last 12 months
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 h-[320px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ComposedChart data={growthChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradientStorage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-files)" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="var(--color-files)" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-xs font-medium"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(val) => `${val} MB`}
                        className="text-xs font-medium"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        hide
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent indicator="line" />}
                        cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--primary))", strokeWidth: 1.5 }}
                      />
                      <Bar 
                        yAxisId="left" 
                        dataKey="storage" 
                        fill="url(#barGradientStorage)" 
                        radius={[6, 6, 0, 0]}
                        className="hover:opacity-80 transition-opacity"
                      />
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="files" 
                        stroke="var(--color-storage)" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: "var(--color-storage)", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                        activeDot={{ r: 6, strokeWidth: 2 }}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ComposedChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Largest Files Table - Enhanced */}
            <div className="px-4 lg:px-6">
              <Card className="shadow-2xl border-0 ring-1 ring-border/30 hover:ring-primary/20 transition-all duration-300 rounded-3xl overflow-hidden backdrop-blur-sm bg-gradient-to-br from-background via-background to-muted/5">
                <CardHeader className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                  <CardTitle className="text-xl sm:text-2xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Largest Files
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm font-medium">
                    Top 5 files taking up the most space
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {decryptedTopFiles.map((file, index) => (
                      <div 
                        key={file.id} 
                        className="group flex items-center justify-between p-4 rounded-2xl hover:bg-gradient-to-r hover:from-primary/5 hover:via-primary/10 hover:to-transparent transition-all duration-300 border border-transparent hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
                      >
                        <div className="flex items-center gap-4 overflow-hidden flex-1">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-xl blur-md group-hover:blur-lg transition-all" />
                            <div className="relative p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-sm ring-1 ring-border/50 group-hover:ring-primary/50 transition-all">
                              {getFileIcon(file.mimeType)}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold ring-1 ring-primary/30">
                                {index + 1}
                              </span>
                              <p className="font-bold truncate text-sm sm:text-base group-hover:text-primary transition-colors">
                                {file.name}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
                              {format(new Date(file.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap pl-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 ring-1 ring-primary/20 group-hover:ring-primary/40 transition-all">
                            <IconDatabase className="h-4 w-4 text-primary" />
                            <p className="font-black text-sm sm:text-base text-primary">{file.sizeReadable}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {decryptedTopFiles.length === 0 && (
                      <div className="text-center py-12">
                        <IconFiles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No files found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analytics Data Table - Enhanced */}
            <div className="px-4 lg:px-6">
              <Card className="shadow-2xl border-0 ring-1 ring-border/30 hover:ring-primary/20 transition-all duration-300 rounded-3xl overflow-hidden backdrop-blur-sm bg-gradient-to-br from-background via-background to-muted/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                  <div className="space-y-1">
                    <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      Activity Log
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <CardDescription className="text-xs sm:text-sm font-medium">Detailed breakdown of file activities and analytics</CardDescription>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconHelpCircle className="h-4 w-4 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs bg-background/95 backdrop-blur-sm">
                            <p className="text-xs font-medium">
                              Showing events from the last
                              <span className="font-black text-primary px-1">
                                {analytics?.overview?.plan === 'unlimited' ? '∞' : (analytics?.overview?.plan === 'pro' ? '180' : (analytics?.overview?.plan === 'plus' ? '60' : '7'))} days
                              </span>
                              based on your <span className="capitalize font-bold">{analytics?.overview?.plan || 'Free'}</span> plan.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          size="sm"
                          className={cn(
                            "h-9 justify-start text-left font-semibold px-3 rounded-xl hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>

                    {dateRange && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
                        onClick={() => setDateRange(undefined)}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    )}

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-40 justify-start text-xs px-3 font-semibold rounded-xl hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all">
                          <span className="truncate text-xs">{activityEventType ? activityEventType.replace(/_/g, ' ') : 'All Events'}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0 rounded-2xl" align="start">
                        <div className="max-h-[350px] overflow-y-auto">
                          <div className="flex flex-col p-1">
                            <button onClick={() => setActivityEventType('')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">All Events</button>
                            <button onClick={() => setActivityEventType('FILE_UPLOAD')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">File Upload</button>
                            <button onClick={() => setActivityEventType('FILE_CREATE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">File Create</button>
                            <button onClick={() => setActivityEventType('FILE_RENAME')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">File Rename</button>
                            <button onClick={() => setActivityEventType('FILE_MOVE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">File Move</button>
                            <button onClick={() => setActivityEventType('FILE_DELETE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">File Delete</button>
                            <button onClick={() => setActivityEventType('TRASH_MOVE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Trash Move</button>
                            <button onClick={() => setActivityEventType('TRASH_RESTORE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Trash Restore</button>
                            <button onClick={() => setActivityEventType('FOLDER_CREATE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Folder Create</button>
                            <button onClick={() => setActivityEventType('FOLDER_RENAME')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Folder Rename</button>
                            <button onClick={() => setActivityEventType('FOLDER_MOVE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Folder Move</button>
                            <button onClick={() => setActivityEventType('FOLDER_DELETE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Folder Delete</button>
                            <button onClick={() => setActivityEventType('SHARE_CREATE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Share Create</button>
                            <button onClick={() => setActivityEventType('SHARE_REVOKE')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Share Revoke</button>
                            <button onClick={() => setActivityEventType('LOGIN')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Login</button>
                            <button onClick={() => setActivityEventType('LOGOUT')} className="px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors rounded-xl font-medium">Logout</button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all" 
                            onClick={handleRefresh}
                          >
                            <IconRefresh className={`h-4 w-4 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-background/95 backdrop-blur-sm">
                          <p className="font-medium">Refresh Log</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                            onClick={() => {
                              if (isExporting) return;
                              handleExport();
                            }}
                            aria-disabled={isExporting}
                          >
                            {isExporting ? (
                              <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <IconDownload className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-background/95 backdrop-blur-sm">
                          <p className="font-medium">Export CSV</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                            onClick={handleWipe}
                            disabled={activityLogs.length === 0}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-background/95 backdrop-blur-sm">
                          <p className="font-medium">Wipe History</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <InsightsDataTable
                    data={activityLogs}
                    pagination={logsPagination}
                    onPaginationChange={setLogsPagination}
                    pageCount={totalPages}
                    totalItems={totalLogs}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Wipe Confirmation Dialog */}
      <AlertDialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all your activity history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWipe} className="bg-red-500 hover:bg-red-600">
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Alert Dialog */}
      <AlertDialog open={!!upgradeDialogData?.open} onOpenChange={(open: boolean) => !open && setUpgradeDialogData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{upgradeDialogData?.title}</AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-sm">
              {upgradeDialogData?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel>Maybe later</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setUpgradeDialogData(null); window.location.href = '/pricing'; }} className="bg-primary">Upgrade</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
