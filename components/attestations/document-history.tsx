"use client"

import * as React from "react"
import {
    IconFileText,
    IconDownload,
    IconSearch,
    IconRefresh,
    IconChevronLeft,
    IconChevronRight,
    IconShieldCheck,
    IconMapPin,
    IconInfoCircle
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { apiClient as api } from "@/lib/api"
import { format } from "date-fns"
import { AttestationDocument } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import { decryptFilename } from "@/lib/crypto"
import { decryptString } from "@/lib/attestations/crypto"

interface DocumentHistoryProps {
    downloadFile: (fileId: string, filename: string, fileSize: number, mimeType: string) => void
}

export function DocumentHistory({ downloadFile }: DocumentHistoryProps) {
    const [documents, setDocuments] = React.useState<AttestationDocument[]>([])
    const [loading, setLoading] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState("")
    const [page, setPage] = React.useState(1)
    const itemsPerPage = 10

    React.useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        setLoading(true)
        try {
            const response = await api.getSignedDocuments();
            if (response.success && response.data) {
                const docs = response.data.documents;
                const masterKey = masterKeyManager.getMasterKey();

                if (masterKey) {
                    const decryptedDocs = await Promise.all(docs.map(async (doc) => {
                        let filename = doc.file.filename;
                        let keyName = doc.key.name;

                        try {
                            // Decrypt filename if salt is present
                            if (doc.file.filenameSalt) {
                                filename = await decryptFilename(doc.file.filename, doc.file.filenameSalt, masterKey);
                            }
                        } catch (e) {
                            console.warn("Failed to decrypt filename", e);
                        }

                        try {
                            // Decrypt key name
                            keyName = await decryptString(doc.key.name, masterKey);
                        } catch (e) {
                            console.warn("Failed to decrypt key name", e);
                        }

                        return {
                            ...doc,
                            file: { ...doc.file, filename },
                            key: { ...doc.key, name: keyName }
                        };
                    }));
                    setDocuments(decryptedDocs);
                } else {
                    setDocuments(docs);
                }
            } else {
                toast.error(response.error || "Failed to load signed documents");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load signed documents");
        } finally {
            setLoading(false);
        }
    }

    const filteredDocuments = React.useMemo(() => {
        if (!searchQuery) return documents;
        const lowerQ = searchQuery.toLowerCase();
        return documents.filter(doc =>
            doc.file.filename.toLowerCase().includes(lowerQ) ||
            doc.reason?.toLowerCase().includes(lowerQ) ||
            doc.location?.toLowerCase().includes(lowerQ) ||
            doc.key.name.toLowerCase().includes(lowerQ)
        );
    }, [documents, searchQuery]);

    const paginatedDocuments = React.useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredDocuments.slice(start, start + itemsPerPage);
    }, [filteredDocuments, page]);

    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium">Signed Documents</h3>
                    <p className="text-sm text-muted-foreground">
                        History of documents signed with your cryptographic identities.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchDocuments} disabled={loading} title="Refresh">
                        <IconRefresh className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead>Document</TableHead>
                            <TableHead>Signing Identity</TableHead>
                            <TableHead>Context</TableHead>
                            <TableHead className="text-right">Signed Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <IconRefresh className="size-4 animate-spin" />
                                        Loading documents...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : paginatedDocuments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No signed documents found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedDocuments.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-red-500/10 text-red-600">
                                                <IconFileText className="size-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm truncate max-w-[200px]" title={doc.file.filename}>
                                                    {doc.file.filename}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {(doc.file.size / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <IconShieldCheck className="size-4 text-emerald-600" />
                                            <span className="text-sm">{doc.key.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {doc.reason && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Reason">
                                                    <IconInfoCircle className="size-3" />
                                                    <span className="truncate max-w-[150px]">{doc.reason}</span>
                                                </div>
                                            )}
                                            {doc.location && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Location">
                                                    <IconMapPin className="size-3" />
                                                    <span className="truncate max-w-[150px]">{doc.location}</span>
                                                </div>
                                            )}
                                            {!doc.reason && !doc.location && (
                                                <span className="text-xs text-muted-foreground italic">No context provided</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-medium">
                                                {format(new Date(doc.createdAt), "MMM d, yyyy")}
                                            </span>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {format(new Date(doc.createdAt), "HH:mm")}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => downloadFile(doc.file.id, doc.file.filename, doc.file.size, doc.file.mimeType)}
                                            title="Download Signed PDF"
                                        >
                                            <IconDownload className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

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
