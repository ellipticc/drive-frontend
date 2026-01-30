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
    color: "hsl(var(--primary))",
  },
  files: {
    label: "Files",
    color: "hsl(var(--chart-2))",
  },
  uploads: {
    label: "Uploads",
    color: "hsl(var(--primary))",
  },
  size: {
    label: "Size",
    color: "hsl(var(--chart-4))",
  },
  desktop: {
    label: "Desktop",
    color: "hsl(var(--primary))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const PIE_COLORS = [
  "hsl(var(--primary))",
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
      setUpgradeDialogData({ open: true, title: 'Upgrade required', description: 'Exporting activity logs is available on Pro & Unlimited plans.' });
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
      <div className="flex h-full w-full flex-col overflow-hidden">
        <SiteHeader onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} sticky />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
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
      <div className="flex h-full w-full flex-col overflow-hidden">
        <SiteHeader onFileUpload={handleFileUpload} onFolderUpload={handleFolderUpload} sticky />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
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
    <div className="flex h-full w-full flex-col overflow-hidden">
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

      <main className="flex-1 overflow-y-auto pb-8">
        <div className="w-full max-w-[1600px] mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Insights Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Monitor your storage, activity, and performance
              </p>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 3 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium uppercase">Used Storage</CardDescription>
                  <CardTitle className="text-2xl font-bold">{overview.totalStorageReadable}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${overview.percentUsed}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overview.percentUsed}% of {overview.quotaReadable}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium uppercase">Total Files</CardDescription>
                  <CardTitle className="text-2xl font-bold">{overview.totalFiles.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {overview.totalVersions} versions saved
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider">Trash Items</CardDescription>
                    <IconTrash className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-3xl font-bold">{overview.deletedFiles.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(overview.deletedSize)} in trash
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider">Storage Plan</CardDescription>
                    <IconChartBar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-3xl font-bold capitalize">{overview.plan}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {overview.quotaReadable} total quota
                  </p>
                </CardContent>
              </Card>
            </div>

          {/* Main Charts */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {/* Storage Growth */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Storage Growth</CardTitle>
                      <CardDescription className="mt-1">
                        Storage usage over the last {timeRangeLabel}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                      <AreaChart data={storageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          minTickGap={32}
                          tickFormatter={(val) => format(new Date(val), "MMM d")}
                          className="text-xs"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tickFormatter={(val) => `${val} MB`}
                          className="text-xs"
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                            />
                          }
                        />
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
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Content Type</CardTitle>
                <CardDescription className="mt-1">
                  Distribution by file type
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] flex items-center justify-center pt-2">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                        {typeChartData.map((_entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

          {/* Activity Charts */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Upload Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Activity</CardTitle>
                <CardDescription className="mt-1">
                  New files uploaded in the last {timeRangeLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(val) => format(new Date(val), "MMM d")}
                        className="text-xs"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-xs"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="uploads"
                        fill="var(--color-uploads)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

            {/* Monthly Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Growth</CardTitle>
                <CardDescription className="mt-1">
                  Storage and file count over the last 12 months
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <ComposedChart data={growthChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-xs"
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(val) => `${val} MB`}
                        className="text-xs"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        hide
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        yAxisId="left"
                        dataKey="storage"
                        fill="var(--color-files)"
                        radius={[4, 4, 0, 0]}
                        fillOpacity={0.6}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="files"
                        stroke="var(--color-storage)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ComposedChart>
                  </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Largest Files */}
          <Card>
            <CardHeader>
              <CardTitle>Largest Files</CardTitle>
              <CardDescription className="mt-1">
                Top 5 files by storage size
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {decryptedTopFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      <div className="p-2 rounded-md bg-muted">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-sm">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(file.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap pl-4">
                      <p className="font-semibold text-sm">{file.sizeReadable}</p>
                    </div>
                  </div>
                ))}
                {decryptedTopFiles.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No files found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analytics Data Table */}
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

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-36 justify-start text-xs px-3">
                          <span className="truncate text-xs">{activityEventType ? activityEventType.replace(/_/g, ' ') : 'All Events'}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <div className="max-h-[300px] overflow-y-auto">
                          <div className="flex flex-col">
                            <button onClick={() => setActivityEventType('')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">All Events</button>
                            <button onClick={() => setActivityEventType('FILE_UPLOAD')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">File Upload</button>
                            <button onClick={() => setActivityEventType('FILE_CREATE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">File Create</button>
                            <button onClick={() => setActivityEventType('FILE_RENAME')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">File Rename</button>
                            <button onClick={() => setActivityEventType('FILE_MOVE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">File Move</button>
                            <button onClick={() => setActivityEventType('FILE_DELETE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">File Delete</button>
                            <button onClick={() => setActivityEventType('TRASH_MOVE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Trash Move</button>
                            <button onClick={() => setActivityEventType('TRASH_RESTORE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Trash Restore</button>
                            <button onClick={() => setActivityEventType('FOLDER_CREATE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Folder Create</button>
                            <button onClick={() => setActivityEventType('FOLDER_RENAME')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Folder Rename</button>
                            <button onClick={() => setActivityEventType('FOLDER_MOVE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Folder Move</button>
                            <button onClick={() => setActivityEventType('FOLDER_DELETE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Folder Delete</button>
                            <button onClick={() => setActivityEventType('SHARE_CREATE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Share Create</button>
                            <button onClick={() => setActivityEventType('SHARE_REVOKE')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Share Revoke</button>
                            <button onClick={() => setActivityEventType('LOGIN')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Login</button>
                            <button onClick={() => setActivityEventType('LOGOUT')} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">Logout</button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

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
