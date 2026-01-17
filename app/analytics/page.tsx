"use client"

import { useState, useLayoutEffect, useEffect } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, Legend, ResponsiveContainer } from "recharts"
import { apiClient } from "@/lib/api"
import { IconLoader2, IconTrendingUp, IconFiles, IconHistory, IconRuler } from "@tabler/icons-react"
import { format } from "date-fns"

const chartConfig = {
  storage: {
    label: "Storage Used",
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
} satisfies ChartConfig

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [timeRange, setTimeRange] = useState(30)

  // Set page title
  useLayoutEffect(() => {
    document.title = "Analytics - Ellipticc Drive"
  }, [])

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true)
      try {
        const response = await apiClient.getDashboardAnalytics(timeRange)
        if (response.success && response.data) {
          setAnalytics(response.data)
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
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
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

  const { overview, storageOverTime, fileTypeBreakdown, recentActivity } = analytics

  // Format storage data for chart
  const storageChartData = storageOverTime.map((item: any) => ({
    date: format(new Date(item.date), "MMM dd"),
    storage: (item.storage / (1024 * 1024)).toFixed(2), // Convert to MB
  }))

  // Format activity data
  const activityChartData = recentActivity.map((item: any) => ({
    date: format(new Date(item.date), "MMM dd"),
    uploads: item.uploads,
  }))

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <SiteHeader />
      
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground mt-1">
                Track your storage usage and activity over time
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    timeRange === days
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalStorageReadable}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.percentUsed}% of {overview.quotaReadable}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                <IconFiles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalFiles.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.deletedFiles} in trash
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Version History</CardTitle>
                <IconHistory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalVersions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Snapshots stored
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg File Size</CardTitle>
                <IconRuler className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.avgFileSizeReadable}</div>
                <p className="text-xs text-muted-foreground">
                  Per upload
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Storage Over Time */}
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Storage Usage Over Time</CardTitle>
                <CardDescription>
                  Your storage consumption for the last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <AreaChart
                    accessibilityLayer
                    data={storageChartData}
                    margin={{
                      left: 12,
                      right: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value} MB`}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                      formatter={(value) => [`${value} MB`, "Storage"]}
                    />
                    <Area
                      dataKey="storage"
                      type="monotone"
                      fill="var(--color-storage)"
                      fillOpacity={0.4}
                      stroke="var(--color-storage)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Upload Activity */}
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Upload Activity</CardTitle>
                <CardDescription>
                  Daily uploads for the last 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart
                    accessibilityLayer
                    data={activityChartData}
                    margin={{
                      left: 12,
                      right: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                      formatter={(value) => [`${value}`, "Uploads"]}
                    />
                    <Bar
                      dataKey="uploads"
                      fill="var(--color-uploads)"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* File Type Breakdown */}
            <Card className="rounded-xl md:col-span-2">
              <CardHeader>
                <CardTitle>Storage by File Type</CardTitle>
                <CardDescription>
                  Distribution of your storage across different file types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-full md:w-1/2">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={fileTypeBreakdown}
                          dataKey="size"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.type}: ${entry.sizeReadable}`}
                        >
                          {fileTypeBreakdown.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium">{data.type}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-muted-foreground">Size:</span>
                                      <span className="text-xs font-bold">{data.sizeReadable}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-muted-foreground">Files:</span>
                                      <span className="text-xs font-bold">{data.count}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 space-y-3">
                    {fileTypeBreakdown.map((item: any, index: number) => (
                      <div key={item.type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <span className="text-sm font-medium">{item.type}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{item.sizeReadable}</div>
                          <div className="text-xs text-muted-foreground">{item.count} files</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
