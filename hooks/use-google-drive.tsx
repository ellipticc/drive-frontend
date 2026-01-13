"use client"

import { useState, useCallback, useEffect } from 'react'
import { useGlobalUpload } from '@/components/global-upload-context'
import { toast } from 'sonner'

// Types for Google API
declare global {
    interface Window {
        gapi: unknown
        google: unknown
    }
}

interface BlobSlice {
    size: number;
    type: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
}

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly'
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']

// Configuration
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''

/**
 * Virtual File implementation for Google Drive
 * Mimics a File object but fetches content in chunks via Range headers
 */
class GoogleRemoteFile {
    public lastModified: number = Date.now();
    public webkitRelativePath: string = '';

    constructor(
        public id: string,
        public name: string,
        public size: number,
        public type: string,
        private accessToken: string
    ) { }

    // Mimic Blob.slice - returns a synchronous object that allows asynchronous reading
    slice(start?: number, end?: number): BlobSlice {
        const s = start || 0;
        const e = end !== undefined ? end : this.size;

        return {
            size: e - s,
            type: this.type,
            // The upload pipeline calls .arrayBuffer() on the slice
            arrayBuffer: async () => {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${this.id}?alt=media`, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Range': `bytes=${s}-${e - 1}`
                    },
                });

                if (!response.ok) {
                    if (response.status === 416) {
                        // Range Not Satisfiable - occurs if file is empty or range is invalid
                        return new ArrayBuffer(0);
                    }
                    throw new Error(`Failed to fetch file chunk from Google Drive: ${response.statusText}`);
                }

                return await response.arrayBuffer();
            }
        };
    }
}

export function useGoogleDrive() {
    const [isApiLoaded, setIsApiLoaded] = useState(false)
    const [tokenClient, setTokenClient] = useState<unknown>(null)
    const { startUploadWithFiles, openModal } = useGlobalUpload()

    // Load Google API scripts
    useEffect(() => {
        const loadScripts = async () => {
            try {
                // Load gapi script
                if (!window.gapi) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script')
                        script.src = 'https://apis.google.com/js/api.js'
                        script.async = true
                        script.defer = true
                        script.onload = () => resolve()
                        script.onerror = (err) => reject(err)
                        document.body.appendChild(script)
                    })
                }

                // Load GIS script
                if (!window.google) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script')
                        script.src = 'https://accounts.google.com/gsi/client'
                        script.async = true
                        script.defer = true
                        script.onload = () => resolve()
                        script.onerror = (err) => reject(err)
                        document.body.appendChild(script)
                    })
                }

                // Initialize gapi
                await new Promise<void>((resolve) => {
                    (window as unknown as { gapi: { load: (s: string, cb: () => void) => void } }).gapi.load('client:picker', resolve)
                })

                // Initialize Token Client
                const client = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (config: unknown) => unknown } } } }).google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // Defined at request time
                })
                setTokenClient(client)
                setIsApiLoaded(true)

            } catch (error) {
                console.error('Failed to load Google Drive API:', error)
                toast.error('Failed to load Google Drive integration')
            }
        }

        loadScripts()
    }, [])

    const handlePickerCallback = async (data: unknown, accessToken: string) => {
        const d = data as any;
        if (d.action === (window as any).google.picker.Action.PICKED) {
            const documents = d[(window as any).google.picker.Response.DOCUMENTS]

            let successCount = 0
            const virtualFiles: GoogleRemoteFile[] = []

            for (const doc of documents) {
                try {
                    const fileId = doc[(window as any).google.picker.Document.ID]
                    const fileName = doc[(window as any).google.picker.Document.NAME]
                    let fileMime = doc[(window as any).google.picker.Document.MIME_TYPE]

                    // Initial size check
                    let fileSize = doc[(window as any).google.picker.Document.SIZE_BYTES] ??
                        doc.sizeBytes ??
                        doc.fileSize ??
                        doc.size ??
                        0;

                    // CRITICAL: If Picker says 0 bytes, verify with the API
                    // Picker often returns 0 for certain file types or restricted views
                    if (!fileSize || fileSize === 0) {
                        console.log(`[GoogleDrive] Picker reported 0 bytes for ${fileName}. Fetching real metadata...`);
                        try {
                            const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,mimeType`, {
                                headers: { 'Authorization': `Bearer ${accessToken}` }
                            });
                            if (metaResp.ok) {
                                const meta = await metaResp.json();
                                if (meta.size) {
                                    fileSize = parseInt(meta.size);
                                    console.log(`[GoogleDrive] Corrected size for ${fileName}: ${fileSize} bytes`);
                                }
                                if (meta.mimeType) fileMime = meta.mimeType;
                            }
                        } catch (metaErr) {
                            console.warn(`[GoogleDrive] Failed to fetch metadata for ${fileName}`, metaErr);
                        }
                    }

                    console.log(`[GoogleDrive] Selected: ${fileName} (${fileSize} bytes)`);

                    // Instead of downloading the whole blob, we create a light wrapper
                    const virtualFile = new GoogleRemoteFile(
                        fileId,
                        fileName,
                        Number(fileSize),
                        fileMime || 'application/octet-stream',
                        accessToken
                    )

                    virtualFiles.push(virtualFile)
                    successCount++
                } catch (error) {
                    toast.error(`Failed to prepare ${doc.name}`)
                }
            }

            if (successCount > 0) {
                // Pass the virtual files to the upload pipeline
                // The pipeline will fetch chunks on-demand via GoogleRemoteFile.slice().arrayBuffer()
                // @ts-expect-error - casting virtual files to File[] as they satisfy the required interface
                startUploadWithFiles(virtualFiles, null)

                openModal()
                toast.success(`Started importing ${successCount} file(s) from Google Drive`)
            }
        }
    }

    const openPicker = useCallback(() => {
        if (!isApiLoaded || !tokenClient) {
            toast.error('Google Drive integration is still loading...')
            return
        }

        // Request access token
        // eslint-disable-next-line react-hooks/immutability
        (tokenClient as any).callback = async (response: unknown) => {
            const r = response as any;
            if (r.error !== undefined) {
                throw (r)
            }

            const accessToken = r.access_token

            if (!(window as any).gapi.client) {
                // ensure gapi client is ready, sometimes load is slow
                await new Promise<void>((resolve) => (window as any).gapi.load('client:picker', resolve));
            }

            const view = new (window as any).google.picker.View((window as any).google.picker.ViewId.DOCS)

            const picker = new (window as any).google.picker.PickerBuilder()
                .setDeveloperKey(GOOGLE_API_KEY)
                .setAppId(GOOGLE_CLIENT_ID)
                .setOAuthToken(accessToken)
                .addView(view)
                .addView(new (window as any).google.picker.DocsUploadView())
                .enableFeature((window as any).google.picker.Feature.MULTISELECT_ENABLED)
                .setCallback((data: unknown) => handlePickerCallback(data, accessToken))
                .build()

            picker.setVisible(true)
        }

        // Trigger OAuth flow if needed, or get token silently
        // prompt: '' will try to use existing session if possible
        (tokenClient as any).requestAccessToken({ prompt: '' })

    }, [isApiLoaded, tokenClient, startUploadWithFiles, openModal])

    return { openPicker, isReady: isApiLoaded }
}
