"use client"

import * as React from "react"
import {
    IconShieldLock,
    IconRefresh,
    IconDownload,
    IconCopy
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
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

import { apiClient } from "@/lib/api-service"
import { format } from "date-fns"

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
    const limit = 10

    React.useEffect(() => {
        fetchLogs()
    }, [page])

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const data = await apiClient.get<any>(`/attestations/logs?page=${page}&limit=${limit}`)
            setLogs(data.logs)
            setTotalPages(data.totalPages)
            setPage(data.page)
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Attestation Audit Log</h3>
                    <p className="text-sm text-muted-foreground">
                        Cryptographically chained record of all key operations and signings.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                        <IconRefresh className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadLogs} disabled={loading || logs.length === 0}>
                        <IconDownload className="mr-2 size-4" />
                        Download
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Hash Chain</TableHead>
                                <TableHead>Time & Location</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No events recorded yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{log.action.replace('_', ' ')}</span>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span
                                                                className="text-xs text-muted-foreground font-mono cursor-pointer hover:text-foreground flex items-center gap-1"
                                                                onClick={() => copyToClipboard(log.id)}
                                                            >
                                                                {truncateMiddle(log.id)}
                                                                <IconCopy className="size-3" />
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Event ID: {log.id}</p>
                                                            <p className="text-xs text-muted-foreground">Click to copy</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="relative rounded bg-muted max-w-[200px] truncate px-[0.3rem] py-[0.2rem] font-mono text-xs">
                                                {JSON.stringify(log.details)}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground cursor-help">
                                                                <IconShieldLock className="size-3 text-emerald-500" />
                                                                {truncateMiddle(log.hash)}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-sm">
                                                            <p className="font-bold">Current Hash (SHA-256):</p>
                                                            <p className="font-mono text-xs break-all">{log.hash}</p>
                                                            <div className="my-2 border-t" />
                                                            <p className="font-bold">Previous Hash:</p>
                                                            <p className="font-mono text-xs break-all">{log.previous_hash}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-xs">
                                                <span>{format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}</span>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-muted-foreground cursor-help truncate max-w-[150px]">
                                                                {log.ip_address || 'Unknown IP'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>IP: {log.ip_address}</p>
                                                            <p>UA: {log.user_agent}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                {totalPages > 1 && (
                    <div className="flex items-center justify-end space-x-2 py-4 px-4 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                        >
                            Previous
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    )
}
