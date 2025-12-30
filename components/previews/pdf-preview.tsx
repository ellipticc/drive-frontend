"use client"

import { useEffect, useState } from "react"
import { IconLoader2 as Loader2, IconAlertCircle as AlertCircle } from "@tabler/icons-react"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"

interface PdfPreviewProps {
    fileId: string
    mimeType?: string
    mimetype?: string
    fileSize?: number
    fileName?: string
    filename?: string

    shareDetails?: any
    onGetShareCEK?: () => Promise<Uint8Array>

    onProgress?: (progress: DownloadProgress) => void
    onError?: (error: string) => void

    isLoading?: boolean
    setIsLoading?: (loading: boolean) => void
}

export function PdfPreview({
    fileId,
    mimeType,
    mimetype,
    fileName,
    filename,
    shareDetails,
    onGetShareCEK,
    onProgress,
    onError,
    isLoading: externalIsLoading,
    setIsLoading: setExternalIsLoading
}: PdfPreviewProps) {
    const [internalIsLoading, setInternalIsLoading] = useState(false)
    const [internalError, setInternalError] = useState<string | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)

    const isLoading = externalIsLoading ?? internalIsLoading
    const setIsLoading = setExternalIsLoading ?? setInternalIsLoading
    const error = internalError

    useEffect(() => {
        let isMounted = true
        let url: string | null = null
        const abortController = new AbortController()

        const loadPdf = async () => {
            try {
                setIsLoading(true)
                setInternalError(null)

                let result;

                // 1. Download & Decrypt
                if (onGetShareCEK) {
                    const shareCekRaw = await onGetShareCEK()
                    const shareCek = new Uint8Array(shareCekRaw);

                    let fileCek = shareCek;

                    if (shareDetails) {
                        if (!shareDetails.is_folder && shareDetails.wrapped_cek && shareDetails.nonce_wrap) {
                            try {
                                fileCek = new Uint8Array(decryptData(shareDetails.wrapped_cek, shareCek, shareDetails.nonce_wrap));
                            } catch (e) {
                                console.error('Failed to unwrap file key:', e);
                            }
                        }
                    }

                    result = await downloadEncryptedFileWithCEK(fileId, fileCek, onProgress, abortController.signal)
                } else {
                    result = await downloadEncryptedFile(fileId, undefined, onProgress, abortController.signal)
                }

                if (!isMounted) return

                // 2. Create Blob URL
                const blob = new Blob([result.blob], { type: 'application/pdf' });
                url = URL.createObjectURL(blob);
                setPdfUrl(url)

            } catch (err) {
                if (!isMounted || (err instanceof Error && err.name === 'AbortError')) return
                const errorMessage = err instanceof Error ? err.message : "Failed to load PDF preview"
                console.error("Failed to load PDF preview:", err)
                setInternalError(errorMessage)
                onError?.(errorMessage)
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }

        loadPdf()

        return () => {
            isMounted = false
            abortController.abort()
            if (url) URL.revokeObjectURL(url)
        }
    }, [fileId, onGetShareCEK, setIsLoading, onProgress, onError, shareDetails])

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="font-medium">{error}</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-muted-foreground text-sm">Loading PDF...</p>
            </div>
        )
    }

    return (
        <div className="w-full h-[85vh] px-4 pb-6 flex flex-col items-center overflow-hidden">
            {pdfUrl ? (
                <iframe
                    src={pdfUrl + "#toolbar=1&view=FitH"}
                    className="w-full h-full rounded-lg bg-white block shadow-sm"
                    title={fileName || "PDF Preview"}
                />
            ) : null}
        </div>
    )
}
