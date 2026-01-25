
"use client"

import * as React from "react"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { KeyManager } from "./key-manager"
import { PdfSignerView } from "./pdf-signer-view"

export function AttestationsView() {
    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Attestations</h2>
            </div>

            <Tabs defaultValue="sign" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sign">Sign Document</TabsTrigger>
                    <TabsTrigger value="keys">Manage Keys</TabsTrigger>
                </TabsList>
                <TabsContent value="sign" className="space-y-4">
                    <PdfSignerView />
                </TabsContent>
                <TabsContent value="keys" className="space-y-4">
                    <KeyManager />
                </TabsContent>
            </Tabs>
        </div>
    )
}
