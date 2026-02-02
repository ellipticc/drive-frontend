
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

export function AttestationsView() {
    return (
        <div className="flex flex-col h-full space-y-6 pt-6 px-6">
            <Tabs defaultValue="sign" className="space-y-4">
                <TabsList className="bg-muted/50 border">
                    <TabsTrigger value="sign">Sign Document</TabsTrigger>
                    <TabsTrigger value="keys">Manage Keys</TabsTrigger>
                    <TabsTrigger value="logs">Audit Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="sign" className="space-y-4">
                    <PdfSignerView />
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
    )
}
