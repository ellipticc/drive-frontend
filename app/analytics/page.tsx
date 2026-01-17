"use client"

import { useState, useLayoutEffect, useEffect } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer, Line, LineChart, ComposedChart } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"
import { IconLoader2, IconTrendingUp, IconFiles, IconHistory, IconRuler, IconDatabase, IconTrash, IconChartBar, IconFile, IconPhoto, IconVideo, IconMusic, IconFileText } from "@tabler/icons-react"
import { format } from "date-fns"
import { masterKeyManager } from "@/lib/master-key"
import { decryptFilename } from "@/lib/crypto"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFileSize } from "@/lib/utils"

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

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [timeRange, setTimeRange] = useState("30d")
  const [decryptedTopFiles, setDecryptedTopFiles] = useState<any[]>([])

  // Set page title
  useLayoutEffect(() => {
    document.title = "Analytics - Ellipticc Drive"
  }, [])

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true)
      try {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
        const response = await apiClient.getDashboardAnalytics(days)
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

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <SiteHeader />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 bg-muted/10">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
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
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <SiteHeader />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex items-center justify-center h-full">
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
    files: item.files,
  }))

  const activityChartData = recentActivity.map((item: any) => ({
    date: item.date,
    uploads: item.uploads,
    size: parseFloat((item.uploadedSize / (1024 * 1024)).toFixed(2)) || 0
  }))

  const growthChartData = monthlyGrowth.map((item: any) => ({
    month: item.month,
    files: item.files,
    storage: parseFloat((item.storage / (1024 * 1024)).toFixed(2)),
  }))

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <SiteHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Overview of your storage usage, file distribution, and activity trends.
              </p>
            </div>

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 shadow-sm">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm border-l-4 border-l-chart-1 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{overview.totalStorageReadable}</span>
                  <IconDatabase className="h-4 w-4 text-chart-1 opacity-50" />
                </div>
                <div className="mt-3 h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-chart-1 rounded-full"
                    style={{ width: `${Math.min(parseFloat(overview.percentUsed), 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex justify-between">
                  <span>{overview.percentUsed}% used</span>
                  <span>{overview.quotaReadable} total</span>
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-chart-2 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{overview.totalFiles.toLocaleString()}</span>
                  <IconFiles className="h-4 w-4 text-chart-2 opacity-50" />
                </div>
                <div className="mt-4 flex items-center text-xs text-muted-foreground">
                  <IconTrash className="mr-1 h-3 w-3" />
                  <span>{overview.deletedFiles} items in trash ({formatFileSize(overview.deletedSize)})</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-chart-3 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Avg File Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{overview.avgFileSizeReadable}</span>
                  <IconRuler className="h-4 w-4 text-chart-3 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Global average across all file types
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-chart-5 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Versions Preserved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{overview.totalVersions.toLocaleString()}</span>
                  <IconHistory className="h-4 w-4 text-chart-5 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Document history snapshots
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Chart Area */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Storage Growth - Spans 2 cols */}
            <Card className="lg:col-span-2 shadow-md border-0 ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Storage Growth</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Cumulative storage usage over the last {timeRangeLabel}</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] sm:h-[300px] lg:h-[350px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <AreaChart data={storageChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
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
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => `${val} MB`}
                      style={{ fontSize: '12px' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                    <Area
                      type="monotone"
                      dataKey="storage"
                      stroke="var(--color-storage)"
                      fillOpacity={1}
                      fill="url(#colorStorage)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* File Type Distribution */}
            <Card className="shadow-md border-0 ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Storage Breakdown</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Distribution by file type</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] sm:h-[350px] flex flex-col">
                <div className="flex-1 min-h-0">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <Pie
                        data={fileTypeBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius="40%"
                        outerRadius="70%"
                        paddingAngle={3}
                        dataKey="size"
                        nameKey="type"
                      >
                        {fileTypeBreakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} strokeWidth={0} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    </PieChart>
                  </ChartContainer>
                </div>
                <div className="mt-4 space-y-3 overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
                  {fileTypeBreakdown.map((item: any, index: number) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="font-medium text-foreground/80">{item.type}</span>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold">{item.sizeReadable}</span>
                        <span className="block text-xs text-muted-foreground">{item.count} files</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Recent Upload Activity */}
            <Card className="shadow-md border-0 ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Upload Activity</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Files uploaded daily</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] sm:h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={activityChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis hide />
                    <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.2 }} content={<ChartTooltipContent indicator="line" />} />
                    <Bar dataKey="uploads" fill="var(--color-uploads)" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Monthly Growth Trend (Long term) */}
            <Card className="shadow-md border-0 ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Monthly Growth</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Long-term storage accumulation (last 12 months)</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] sm:h-[300px]">
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

          {/* Largest Files Table */}
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
        </div>
      </main>
    </div>
  )
}
