"use client"

import * as React from "react"
import {
    IconShieldLock,
    IconRefresh,
    IconDownload,
    IconCopy,
    IconSearch,
    IconChevronLeft,
    IconChevronRight,
    IconCalendar,
    IconHash,
    IconUser,
    IconWorld
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import { apiClient as api } from "@/lib/api"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface AuditLog {
    id: string
    action: string
    details: any
    hash: string
    previous_hash: string
    created_at: string
    ip_address: string
    user_agent: string
}

export function AuditLogs() {
    const [logs, setLogs] = React.useState<AuditLog[]>([])
    const [loading, setLoading] = React.useState(false)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [searchQuery, setSearchQuery] = React.useState("")
    const limit = 10

    React.useEffect(() => {
        fetchLogs()
    }, [page])

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const response = await api.getAttestationLogs(page, limit)
            if (response.success && response.data) {
                setLogs(response.data.logs)
                setTotalPages(response.data.totalPages)
                if (page > response.data.totalPages && response.data.totalPages > 0) {
                    setPage(response.data.totalPages);
                }
            } else {
                toast.error(response.error || "Failed to load audit logs");
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to load audit logs")
        } finally {
            setLoading(false)
        }
    }

    const downloadLogs = () => {
        const jsonString = JSON.stringify(logs, null, 2)
        const blob = new Blob([jsonString], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `attestation_logs_${new Date().toISOString()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("Logs downloaded")
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }

    const truncateMiddle = (text: string, length = 12) => {
        if (!text || text.length <= length) return text;
        return `${text.slice(0, 6)}...${text.slice(-6)}`;
    }

    // Filter logs based on search query
    const filteredLogs = React.useMemo(() => {
        if (!searchQuery) return logs;
        const lowerQ = searchQuery.toLowerCase();
        return logs.filter(log =>
            log.action.toLowerCase().includes(lowerQ) ||
            log.id.toLowerCase().includes(lowerQ) ||
            log.hash.toLowerCase().includes(lowerQ) ||
            JSON.stringify(log.details).toLowerCase().includes(lowerQ)
        );
    }, [logs, searchQuery]);

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'KEY_CREATED':
                return <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20">Created</Badge>
            case 'KEY_REVOKED':
                return <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20">Revoked</Badge>
            case 'KEY_DELETED':
                return <Badge variant="outline" className="border-red-500/50 text-red-600 bg-red-500/10 hover:bg-red-500/20">Deleted</Badge>
            case 'DOCUMENT_SIGNED':
                return <Badge variant="outline" className="border-blue-500/50 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20">Signed</Badge>
            default:
                return <Badge variant="outline">{action.replace(/_/g, ' ')}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium">Attestation Audit Logs</h3>
                    <p className="text-sm text-muted-foreground">
                        Cryptographically chained immutable record of all key operations.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading} title="Refresh">
                        <IconRefresh className={cn("size-4", loading && "animate-spin")} />
                    </Button>
                    <Button variant="outline" size="icon" onClick={downloadLogs} disabled={loading || logs.length === 0} title="Download JSON">
                        <IconDownload className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[180px]">Event Type</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Integrity</TableHead>
                            <TableHead className="text-right">Timestamp</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <IconRefresh className="size-4 animate-spin" />
                                            Loading logs...
                                        </div>
                                    ) : (
                                        "No audit logs found matching your criteria"
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            <div>{getActionBadge(log.action)}</div>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-foreground">
                                                            ID: {truncateMiddle(log.id)}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Event ID: {log.id}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <code className="text-xs bg-muted/50 px-1.5 py-1 rounded w-fit max-w-[300px] break-all">
                                                {JSON.stringify(log.details).replace(/"/g, '')}
                                            </code>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1" title="IP Address">
                                                    <IconWorld className="size-3" /> {log.ip_address || "Unknown"}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-500 cursor-help bg-emerald-500/10 px-2 py-1 rounded w-fit">
                                                            <IconShieldLock className="size-3" />
                                                            {truncateMiddle(log.hash)}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-sm">
                                                        <div className="space-y-2">
                                                            <div>
                                                                <p className="font-semibold text-xs text-muted-foreground">Current Hash (SHA-256)</p>
                                                                <p className="font-mono text-xs break-all">{log.hash}</p>
                                                            </div>
                                                            <div className="border-t pt-2">
                                                                <p className="font-semibold text-xs text-muted-foreground">Previous Hash</p>
                                                                <p className="font-mono text-xs break-all">{log.previous_hash}</p>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-medium">
                                                {format(new Date(log.created_at), "MMM d, yyyy")}
                                            </span>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {format(new Date(log.created_at), "HH:mm:ss")}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        <IconChevronLeft className="mr-1 size-4" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                    >
                        Next <IconChevronRight className="ml-1 size-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
