"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconShare,
  IconTrash,
  IconLock,
  IconUpload,
  IconInfoCircle,
} from "@tabler/icons-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export interface ActivityLog {
  id: string
  event_type: string
  item_id: string
  metadata: any
  summary: string
  ip_address: string
  user_agent: string
  user_name: string
  user_email: string
  user_avatar: string
  created_at: string
}

const formatEventName = (type: string) => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const columns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: "id",
    header: "Event ID",
    cell: ({ row }) => {
      const id = row.getValue("id") as string
      return (
        <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                  {id.substring(0, 8)}...
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-mono text-xs">{id}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    },
  },
  {
    accessorKey: "event_type",
    header: "Event",
    cell: ({ row }) => {
      const type = row.getValue("event_type") as string
      return (
        <span className="font-medium text-sm capitalize whitespace-nowrap">
          {type.replace(/_/g, ' ').toLowerCase()}
        </span>
      )
    },
  },
  {
    id: "user",
    header: "User",
    cell: ({ row }) => {
      const name = row.original.user_name || "Unknown User"
      const email = row.original.user_email || "No email"
      const avatar = row.original.user_avatar
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 border shadow-sm">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback className="text-[10px] bg-muted">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm font-medium whitespace-nowrap cursor-help hover:underline decoration-dotted decoration-muted-foreground/30">{name}</span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{email}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    }
  },
  {
    accessorKey: "summary",
    header: "Details",
    cell: ({ row }) => {
      const summary = row.original.summary || "N/A"
      const meta = row.original.metadata

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="max-w-[250px] truncate text-xs text-muted-foreground cursor-help">
                {summary}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[300px]">
              <div className="space-y-2">
                <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b pb-1">Raw Metadata</p>
                <pre className="text-[10px] whitespace-pre-wrap leading-tight">{JSON.stringify(meta, null, 2)}</pre>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: "Date & Time",
    cell: ({ row }) => {
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
          {format(new Date(row.getValue("created_at")), "dd/MM/yyyy HH:mm:ss")}
        </div>
      )
    },
  },
]

interface DataTableProps<TData, TValue> {
  columns?: ColumnDef<TData, TValue>[]
  data: TData[]
  pageCount?: number
  totalItems?: number
  userPlan?: string // 'free', 'plus', 'pro', 'unlimited'
  pagination?: {
    pageIndex: number
    pageSize: number
  }
  onPaginationChange?: (pagination: any) => void
}

const getRetentionDays = (plan: string = 'free') => {
  switch (plan.toLowerCase()) {
    case 'unlimited': return Infinity;
    case 'pro': return 180;
    case 'plus': return 60;
    default: return 7;
  }
}

export function AnalyticsDataTable<TData, TValue>({
  columns: userColumns,
  data,
  pageCount,
  totalItems,
  userPlan = 'free',
  pagination: externalPagination,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const pagination = externalPagination || internalPagination
  const setPagination = onPaginationChange || setInternalPagination

  const tableColumns = userColumns || (columns as unknown as ColumnDef<TData, TValue>[])

  const retentionDays = getRetentionDays(userPlan);

  const table = useReactTable({
    data,
    columns: tableColumns,
    pageCount: pageCount ?? -1,
    manualPagination: !!pageCount,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange: setPagination as any,
    state: {
      pagination,
    },
  })

  return (
    <div className="w-full space-y-4">
      <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${header.id === 'created_at' ? 'text-right' : ''}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-muted/50">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const createdAt = (row.original as any).created_at;
                  const isBlurred = new Date(createdAt).getTime() < Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors group relative ${isBlurred ? 'pointer-events-none select-none' : 'hover:bg-muted/30'}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={`px-4 py-3 ${isBlurred ? 'blur-[4px] opacity-50' : ''}`}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                      {isBlurred && (
                        <td className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border shadow-sm flex items-center gap-2 pointer-events-auto cursor-help">
                            <IconLock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground max-w-[150px] truncate text-center">
                              upgrade to view older history
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={tableColumns.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <IconInfoCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">No activity logs recorded yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground font-medium">
          {totalItems ? `Showing ${data.length} of ${totalItems} events` : `Showing ${data.length} events`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground min-w-[4rem] text-center uppercase tracking-tighter">
            PAGE {pagination.pageIndex + 1} OF {pageCount || '?'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
