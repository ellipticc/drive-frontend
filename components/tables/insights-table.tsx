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
  IconUpload,
  IconPencil,
  IconArrowsMove,
  IconTrash,
  IconTrashX,
  IconRestore,
  IconFolderPlus,
  IconLink,
  IconLinkOff,
  IconLogin,
  IconLogout,
  IconUserPlus,
  IconShieldLock,
  IconFilePlus,
  IconFileText,
  IconCopy,
} from "@tabler/icons-react"

import { toast } from 'sonner'
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
          const type = log.event_type;

          if (type === 'FILE_UPLOAD') summary = `Uploaded file "${decryptedName}"`;
          else if (type === 'FILE_CREATE') summary = `Created file "${decryptedName}"`;
          else if (type === 'FILE_RENAME') {
            const oldName = meta.oldEncryptedName ? await decryptFilename(meta.oldEncryptedName, meta.oldNameSalt, masterKey) : 'unknown';
            summary = `Renamed file from "${oldName}" to "${decryptedName}"`;
          }
          else if (type === 'FILE_MOVE') summary = `Moved file "${decryptedName}"`;
          else if (type === 'TRASH_MOVE') summary = `Moved file "${decryptedName}" to trash`;
          else if (type === 'FILE_DELETE') summary = `Permanently deleted file "${decryptedName}"`;
          else if (type === 'TRASH_RESTORE') summary = `Restored file "${decryptedName}" from trash`;

          else if (type === 'FOLDER_CREATE') summary = `Created folder "${decryptedName}"`;
          else if (type === 'FOLDER_RENAME') {
            const oldName = meta.oldEncryptedName ? await decryptFilename(meta.oldEncryptedName, meta.oldNameSalt, masterKey) : 'unknown';
            summary = `Renamed folder from "${oldName}" to "${decryptedName}"`;
          }
          else if (type === 'FOLDER_MOVE') summary = `Moved folder "${decryptedName}"`;
          else if (type === 'FOLDER_TRASH_MOVE') summary = `Moved folder "${decryptedName}" to trash`;
          else if (type === 'FOLDER_DELETE') summary = `Permanently deleted folder "${decryptedName}"`;

          else if (type === 'SHARE_CREATE') summary = `Created share for "${decryptedName}"`;
          else if (type === 'SHARE_REVOKE') summary = `Revoked share for "${decryptedName}"`;

          else if (type === 'PAPER_CREATE') summary = `Created paper "${decryptedName}"`;
          else if (type === 'PAPER_EDIT') summary = `Edited paper "${decryptedName}"`;
          else if (type === 'PAPER_TRASH') summary = `Moved paper "${decryptedName}" to trash`;
          else if (type === 'PAPER_RESTORE') summary = `Restored paper "${decryptedName}" from trash`;
          else if (type === 'PAPER_DELETE') summary = `Permanently deleted paper "${decryptedName}"`;

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
              <TooltipContent 
                side="top" 
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(id); toast.success('Copied event id'); }}
              >
                <p className="font-mono text-xs break-all">{id}</p>
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

      const getPillProps = (eventType: string) => {
        switch (eventType) {
          case 'FILE_UPLOAD': return { icon: IconUpload, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
          case 'FILE_CREATE': return { icon: IconFilePlus, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
          case 'FILE_RENAME':
          case 'FOLDER_RENAME': return { icon: IconPencil, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
          case 'FILE_MOVE':
          case 'FOLDER_MOVE': return { icon: IconArrowsMove, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' };
          case 'TRASH_MOVE':
          case 'FOLDER_TRASH_MOVE': return { icon: IconTrash, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
          case 'FILE_DELETE':
          case 'FOLDER_DELETE':
          case 'TRASH_EMPTY': return { icon: IconTrashX, color: 'text-red-500 bg-red-500/10 border-red-500/20' };
          case 'TRASH_RESTORE':
          case 'RESTORE': return { icon: IconRestore, color: 'text-green-500 bg-green-500/10 border-green-500/20' };
          case 'FOLDER_CREATE': return { icon: IconFolderPlus, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' };
          case 'SHARE_CREATE': return { icon: IconLink, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' };
          case 'SHARE_REVOKE': return { icon: IconLinkOff, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
          case 'LOGIN': return { icon: IconLogin, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' };
          case 'LOGOUT': return { icon: IconLogout, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' };
          case 'PASSWORD_CHANGE':
          case 'SECURITY_UPDATE': return { icon: IconShieldLock, color: 'text-amber-600 bg-amber-600/10 border-amber-600/20' };
          case 'PAPER_CREATE': return { icon: IconFilePlus, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
          case 'PAPER_EDIT': return { icon: IconPencil, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' };
          case 'PAPER_TRASH': return { icon: IconTrash, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
          case 'PAPER_RESTORE': return { icon: IconRestore, color: 'text-green-500 bg-green-500/10 border-green-500/20' };
          case 'PAPER_DELETE': return { icon: IconTrashX, color: 'text-red-500 bg-red-500/10 border-red-500/20' };
          default: return { icon: IconInfoCircle, color: 'text-muted-foreground bg-muted border-muted-foreground/20' };
        }
      }

      const { icon: Icon, color } = getPillProps(type);

      return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${color}`}>
          <Icon className="w-3 h-3" />
          <span>{type.replace(/_/g, ' ')}</span>
        </div>
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
          <span>{format(new Date(row.getValue("created_at")), "dd/MM/yyyy HH:mm:ss")}</span>
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

  // Upgrade dialog state for blurred/archived rows
  const [upgradeDialogData, setUpgradeDialogData] = React.useState<{ open: boolean; title: string; description: string } | null>(null)

  return (
    <div className="w-full space-y-4">
      <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b sticky top-0 z-40 bg-background">
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
                  const isArchived = (row.original as any).event_type === 'ARCHIVED';
                  const isBlurred = isArchived || new Date(createdAt).getTime() < Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors group relative ${isBlurred ? '' : 'hover:bg-muted/30'}`}
                      onClick={() => {
                        if (isBlurred) {
                          setUpgradeDialogData({ open: true, title: 'Upgrade required', description: 'Upgrade to view older history' });
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const cellId = cell.column.id;
                        const cellBlurClass = (isBlurred && cellId !== 'id' && cellId !== 'created_at') ? 'blur-[4px] opacity-50' : '';
                        return (
                          <td key={cell.id} className={`px-4 py-3 ${cellBlurClass}`}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        )
                      })}
                      {isBlurred && (
                        <td className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <button
                            className="bg-background/90 px-3 py-1 rounded-full border shadow-sm flex items-center gap-2 pointer-events-auto cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setUpgradeDialogData({ open: true, title: 'Upgrade required', description: 'Upgrade to view older history' }); }}
                            aria-label="Upgrade required — Upgrade to view older history"
                          >
                            <IconLock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground max-w-[150px] truncate text-center">
                              Upgrade required
                            </span>
                          </button>
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
