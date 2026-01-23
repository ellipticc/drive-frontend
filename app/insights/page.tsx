"use client"

import { useState, useLayoutEffect, useEffect, useRef } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer, Line, LineChart, ComposedChart } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"
import { IconLoader2, IconHelpCircle, IconTrendingUp, IconFiles, IconHistory, IconRuler, IconDatabase, IconTrash, IconChartBar, IconFile, IconPhoto, IconVideo, IconMusic, IconFileText, IconRefresh, IconDownload, IconInfoCircle, IconCalendar as CalendarIcon, IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
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
        endDate
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

  // Fetch activity logs (Pagination or Date Filter change)
  useEffect(() => {
    fetchLogsOnly()
  }, [logsPagination.pageIndex, logsPagination.pageSize, dateRange])

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

      <main className="flex-1 py-8">
        <div className="w-full space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 lg:px-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
                <span>Insights Dashboard</span>
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                Monitor your storage, activity, and security at a glance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[140px] sm:w-[180px] h-10 rounded-xl border-0 ring-1 ring-border/50 bg-background shadow-sm hover:ring-primary/50 transition-all">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 3 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {/* Stats Overview */}
            <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4 px-4 lg:px-6">
              <Card className="shadow-md border-0 ring-1 ring-border/50 hover:ring-primary/20 transition-all overflow-hidden">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider">Used Storage</CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black">{overview.totalStorageReadable}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${overview.percentUsed}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] sm:text-xs">
                      <span className="text-muted-foreground">{overview.percentUsed}% of {overview.quotaReadable}</span>
                      <IconTrendingUp className="h-3 w-3 text-primary animate-pulse" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md border-0 ring-1 ring-border/50 hover:ring-primary/20 transition-all overflow-hidden">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider">Total Files</CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black">{overview.totalFiles.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <IconHistory className="h-3 w-3" />
                    {overview.totalVersions} document versions saved
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-md border-0 ring-1 ring-border/50 hover:ring-primary/20 transition-all overflow-hidden">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider">Trash Items</CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black">{overview.deletedFiles.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Occupying {formatFileSize(overview.deletedSize)}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-md border-0 ring-1 ring-border/50 hover:ring-primary/20 transition-all overflow-hidden">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider">Storage Plan</CardDescription>
                  <CardTitle className="text-xl sm:text-2xl font-black capitalize">{overview.plan}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <IconRuler className="h-3 w-3" />
                    {overview.quotaReadable} total quota
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 px-4 lg:px-6">
              {/* Storage Usage Over Time */}
              <div className="lg:col-span-2">
                <Card className="h-full shadow-md border-0 ring-1 ring-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-xl">Storage Growth</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Storage usage and file count in the last {timeRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <AreaChart data={storageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-storage)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-storage)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tickFormatter={(val) => format(new Date(val), "MMM d")}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tickFormatter={(val) => `${val} MB`}
                          style={{ fontSize: '12px' }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="storage"
                          stroke="var(--color-storage)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorStorage)"
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              {/* File Type Breakdown */}
              <Card className="shadow-md border-0 ring-1 ring-border/50">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Content Type</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Distribution by file type</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center p-0">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {typeChartData.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 px-4 lg:px-6">
              {/* Recent Activity Histogram */}
              <Card className="shadow-md border-0 ring-1 ring-border/50">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Creation Activity</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">New files and folders in the last {timeRangeLabel}</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(val) => format(new Date(val), "MMM d")}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        style={{ fontSize: '12px' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="uploads" fill="var(--color-uploads)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Monthly Growth */}
              <div className="lg:col-span-1">
                <Card className="h-full shadow-md border-0 ring-1 ring-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-xl">Monthly Ingestion</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Storage added over the last 12 months</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <ComposedChart data={growthChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          yAxisId="left"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tickFormatter={(val) => `${val} MB`}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          hide
                        />
                        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                        <Bar yAxisId="left" dataKey="storage" fill="var(--color-files)" radius={[4, 4, 0, 0]} fillOpacity={0.6} />
                        <Line yAxisId="right" type="monotone" dataKey="files" stroke="var(--color-storage)" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Largest Files Table */}
            <div className="px-4 lg:px-6">
              <Card className="shadow-md border-0 ring-1 ring-border/50">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Largest Files</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Top 5 files taking up the most space</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {decryptedTopFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 rounded bg-muted">
                            {getFileIcon(file.mimeType)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(file.createdAt), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap pl-4">
                          <p className="font-bold text-sm">{file.sizeReadable}</p>
                        </div>
                      </div>
                    ))}
                    {decryptedTopFiles.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No files found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analytics Data Table */}
            <div className="px-4 lg:px-6">
              <Card className="shadow-md border-0 ring-1 ring-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                      Activity Log
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <CardDescription className="text-xs sm:text-sm">Detailed breakdown of file activities and analytics</CardDescription>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconHelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs">
                              Showing events from the last
                              <span className="font-bold text-primary px-1">
                                {analytics?.overview?.plan === 'unlimited' ? '∞' : (analytics?.overview?.plan === 'pro' ? '180' : (analytics?.overview?.plan === 'plus' ? '60' : '7'))} days
                              </span>
                              based on your <span className="capitalize">{analytics?.overview?.plan || 'Free'}</span> plan.
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
                            "h-8 justify-start text-left font-normal px-3",
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
                      <PopoverContent className="w-auto p-0" align="end">
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
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setDateRange(undefined)}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    )}

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleRefresh}>
                            <IconRefresh className={`h-4 w-4 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Refresh Log</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                        <TooltipContent>
                          <p>Export CSV</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={handleWipe}
                            disabled={activityLogs.length === 0}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Wipe History</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent>
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
