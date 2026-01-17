"use client"

import { useLayoutEffect } from "react"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

const chartData = [
  { date: "2024-01-01", storage: 186 },
  { date: "2024-01-02", storage: 305 },
  { date: "2024-01-03", storage: 237 },
  { date: "2024-01-04", storage: 273 },
  { date: "2024-01-05", storage: 209 },
  { date: "2024-01-06", storage: 214 },
  { date: "2024-01-07", storage: 290 },
  { date: "2024-01-08", storage: 320 },
  { date: "2024-01-09", storage: 380 },
  { date: "2024-01-10", storage: 420 },
  { date: "2024-01-11", storage: 450 },
  { date: "2024-01-12", storage: 480 },
]

const chartConfig = {
  storage: {
    label: "Storage Used",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function AnalyticsPage() {
  // Set page title
  useLayoutEffect(() => {
    document.title = "Analytics - Ellipticc Drive"
  }, [])

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
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">480 MB</div>
                <p className="text-xs text-muted-foreground">
                  23.4% of 2 GB
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">
                  +180 this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">342</div>
                <p className="text-xs text-muted-foreground">
                  Snapshots stored
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg File Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">389 KB</div>
                <p className="text-xs text-muted-foreground">
                  Per upload
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Storage Over Time Chart */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Storage Usage Over Time</CardTitle>
              <CardDescription>
                Your storage consumption for the last 12 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" hideLabel />}
                  />
                  <Area
                    dataKey="storage"
                    type="natural"
                    fill="var(--color-storage)"
                    fillOpacity={0.4}
                    stroke="var(--color-storage)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
