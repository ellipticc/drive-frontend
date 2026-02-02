
"use client"

import * as React from "react"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { KeyManager } from "./key-manager"
import { AuditLogs } from "./audit-logs"
import { PdfSignerView } from "./pdf-signer-view"
import { DocumentHistory } from "./document-history"
import { PreviewDownloadManager } from "../shared/preview-download-manager"

export function AttestationsView() {
    const [activeTab, setActiveTab] = React.useState("sign")

    React.useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '')
            if (hash === 'Sign') setActiveTab('sign')
            else if (hash === 'Documents') setActiveTab('documents')
            else if (hash === 'Keys') setActiveTab('keys')
            else if (hash === 'Logs') setActiveTab('logs')
        }

        handleHashChange() // Initial check
        window.addEventListener('hashchange', handleHashChange)
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [])

    const onTabChange = (value: string) => {
        setActiveTab(value)
        if (value === 'sign') window.location.hash = 'Sign'
        else if (value === 'documents') window.location.hash = 'Documents'
        else if (value === 'keys') window.location.hash = 'Keys'
        else if (value === 'logs') window.location.hash = 'Logs'
    }

    return (
        <PreviewDownloadManager>
            {(downloadFile) => (
                <div className="flex flex-col h-full space-y-6 pt-6 px-6">
                    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
                        <TabsList className="bg-muted/50 border">
                            <TabsTrigger value="sign">Sign Document</TabsTrigger>
                            <TabsTrigger value="documents">Documents</TabsTrigger>
                            <TabsTrigger value="keys">Manage Keys</TabsTrigger>
                            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sign" className="space-y-4">
                            <PdfSignerView />
                        </TabsContent>
                        <TabsContent value="documents" className="space-y-4">
                            <DocumentHistory downloadFile={downloadFile} />
                        </TabsContent>
                        <TabsContent value="keys" className="space-y-4">
                            <KeyManager />
                        </TabsContent>
                        <TabsContent value="logs" className="space-y-4">
                            <div className="space-y-6">
                                <AuditLogs />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </PreviewDownloadManager>
    )
}
