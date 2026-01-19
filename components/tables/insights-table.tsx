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
  IconLock,
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
import { getDiceBearAvatar } from "@/lib/avatar"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"

export interface ActivityLog {
  id: string
  event_type: string
  item_id: string
  user_id: string
  metadata: any
  summary: string
  ip_address: string
  user_agent: string
  user_name: string
  user_email: string
  user_avatar: string
  created_at: string
}

const DecryptedSummary = ({ log }: { log: ActivityLog }) => {
  const [decryptedText, setDecryptedText] = React.useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = React.useState(false);

  React.useEffect(() => {
    const decrypt = async () => {
      // If it's blurred/archived, we just show the summary from backend
      if (log.event_type === 'ARCHIVED') {
        setDecryptedText(log.summary);
        return;
      }

      const meta = log.metadata;
      if (!meta) {
        setDecryptedText(log.summary);
        return;
      }

      // Check for encrypted filename and salt in metadata
      const encryptedName = meta.encryptedName;
      const nameSalt = meta.nameSalt;

      if (encryptedName && nameSalt) {
        setIsDecrypting(true);
        try {
          const masterKey = masterKeyManager.getMasterKey();
          const decryptedName = await decryptFilename(encryptedName, nameSalt, masterKey);

          let summary = log.summary;

          // Custom summary logic for decrypted names
          if (log.event_type === 'FILE_UPLOAD') {
            summary = `Uploaded file "${decryptedName}"`;
          } else if (log.event_type === 'FILE_RENAME') {
            const oldEncryptedName = meta.oldEncryptedName;
            const oldNameSalt = meta.oldNameSalt;
            if (oldEncryptedName && oldNameSalt) {
              const oldName = await decryptFilename(oldEncryptedName, oldNameSalt, masterKey);
              summary = `Renamed "${oldName}" to "${decryptedName}"`;
            } else {
              summary = `Renamed file to "${decryptedName}"`;
            }
          } else if (log.event_type === 'FILE_MOVE') {
            summary = `Moved file "${decryptedName}"`;
          } else if (log.event_type === 'TRASH_MOVE') {
            summary = `Moved file "${decryptedName}" to trash`;
          } else if (log.event_type === 'TRASH_RESTORE') {
            summary = `Restored file "${decryptedName}" from trash`;
          } else if (log.event_type === 'FOLDER_CREATE') {
            summary = `Created folder "${decryptedName}"`;
          } else if (log.event_type === 'FOLDER_RENAME') {
            const oldEncryptedName = meta.oldEncryptedName;
            const oldNameSalt = meta.oldNameSalt;
            if (oldEncryptedName && oldNameSalt) {
              const oldName = await decryptFilename(oldEncryptedName, oldNameSalt, masterKey);
              summary = `Renamed folder "${oldName}" to "${decryptedName}"`;
            } else {
              summary = `Renamed folder to "${decryptedName}"`;
            }
          } else if (log.event_type === 'FOLDER_MOVE') {
            summary = `Moved folder "${decryptedName}"`;
          } else if (log.event_type === 'FOLDER_TRASH_MOVE') {
            summary = `Moved folder "${decryptedName}" to trash`;
          }

          setDecryptedText(summary);
        } catch (err) {
          console.error('Decryption failed for activity log:', err);
          setDecryptedText(log.summary);
        } finally {
          setIsDecrypting(false);
        }
      } else {
        setDecryptedText(log.summary);
      }
    };

    decrypt();
  }, [log]);

  if (isDecrypting) {
    return <span className="animate-pulse">Decrypting...</span>;
  }

  return <span>{decryptedText || log.summary}</span>;
};

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
      const avatar = row.original.user_avatar || getDiceBearAvatar(row.original.user_id || row.original.id)

      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 border shadow-sm ring-1 ring-border/10">
            <AvatarImage src={avatar} alt={name} className="object-cover" />
            <AvatarFallback className="text-[10px] bg-muted font-bold text-muted-foreground">
              {name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
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
      return (
        <div className="max-w-[400px] truncate text-xs text-muted-foreground">
          <DecryptedSummary log={row.original} />
        </div>
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

export function InsightsDataTable<TData, TValue>({
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
            <thead className="bg-muted/50 border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/5 rounded-b-lg">
          <p className="text-xs text-muted-foreground font-medium">
            {totalItems ? `Showing ${data.length} of ${totalItems} events` : `Showing ${data.length} events`}
          </p>
          <div className="flex items-center gap-2 bg-background border rounded-lg p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground min-w-[5rem] text-center tracking-tight border-x px-2 mx-1">
              Page {pagination.pageIndex + 1} of {pageCount || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
