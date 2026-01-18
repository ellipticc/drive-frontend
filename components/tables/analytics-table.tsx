"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface ActivityLog {
  id: number
  event_type: string
  item_id: string
  metadata: any
  ip_address: string
  user_agent: string
  created_at: string
}

const getEventIcon = (type: string) => {
  if (type.includes('FILE')) return <IconFile className="h-4 w-4" />
  if (type.includes('FOLDER')) return <IconFolder className="h-4 w-4" />
  if (type.includes('SHARE')) return <IconShare className="h-4 w-4" />
  if (type.includes('TRASH')) return <IconTrash className="h-4 w-4" />
  if (type.includes('LOCK')) return <IconLock className="h-4 w-4" />
  if (type.includes('UPLOAD')) return <IconUpload className="h-4 w-4" />
  return <IconInfoCircle className="h-4 w-4" />
}

const getEventColor = (type: string) => {
  if (type.includes('DELETE') || type.includes('TRASH')) return "destructive"
  if (type.includes('create') || type.includes('UPLOAD') || type.includes('RESTORE')) return "default" // or success if we had it
  if (type.includes('SHARE')) return "secondary"
  return "outline"
}

const formatEventName = (type: string) => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

export const columns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: "event_type",
    header: "Event",
    cell: ({ row }) => {
      const type = row.getValue("event_type") as string
      return (
        <div className="flex items-center gap-2">
          <Badge variant={getEventColor(type) as any} className="gap-1 whitespace-nowrap">
            {getEventIcon(type)}
            {formatEventName(type)}
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: "metadata",
    header: "Details",
    cell: ({ row }) => {
      const meta = row.getValue("metadata") as any
      const type = row.getValue("event_type") as string

      let details = "N/A"

      if (meta) {
        if (type === 'FILE_MOVE') {
          details = `Moved file to folder`
        } else if (type === 'FILE_RENAME') {
          details = `Renamed file`
        } else if (type === 'FOLDER_CREATE') {
          details = `Created new folder`
        } else if (type === 'FILE_UPLOAD') {
          details = `Uploaded file (${meta.fileSize ? (meta.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'unknown size'})`
        } else if (meta.itemType) {
          details = `${meta.itemType} action`
        } else {
          // Fallback to simple JSON string or key info if possible
          const keys = Object.keys(meta).filter(k => k !== 'req' && k !== 'headers' && k !== 'user')
          if (keys.length > 0) details = `${keys.join(', ')}`
        }
      }

      return (
        <div className="max-w-[300px] truncate text-muted-foreground" title={JSON.stringify(meta, null, 2)}>
          {details}
        </div>
      )
    },
  },
  {
    accessorKey: "ip_address",
    header: "IP Address",
    cell: ({ row }) => <div className="font-mono text-xs text-muted-foreground">{row.getValue("ip_address")}</div>,
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => {
      return (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {format(new Date(row.getValue("created_at")), "MMM d, yyyy HH:mm")}
        </div>
      )
    },
  },
]

interface DataTableProps<TData, TValue> {
  columns?: ColumnDef<TData, TValue>[]
  data: TData[]
  pageCount?: number
  pagination?: {
    pageIndex: number
    pageSize: number
  }
  onPaginationChange?: (pagination: any) => void
}

export function AnalyticsDataTable<TData, TValue>({
  columns: userColumns,
  data,
  pageCount,
  pagination: externalPagination,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Use external pagination if provided, otherwise internal
  const pagination = externalPagination || internalPagination
  const setPagination = onPaginationChange || setInternalPagination

  // Use default columns if not provided
  const tableColumns = userColumns || (columns as unknown as ColumnDef<TData, TValue>[])

  const table = useReactTable({
    data,
    columns: tableColumns,
    pageCount: pageCount ?? -1, // -1 means unknown/client-side if not provided
    manualPagination: !!pageCount, // Enable server-side pagination if pageCount is provided
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination as any,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
  })

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
