
"use client"

import * as React from "react"
import { IconFile, IconUpload, IconCheck } from "@tabler/icons-react"
import { useFilePicker } from "use-file-picker"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

import { AttestationStorage } from "@/lib/attestations/storage"
import { signPdf } from "@/lib/attestations/pdf-signer"
import { masterKeyManager } from "@/lib/master-key"
import type { AttestationKey } from "@/lib/attestations/types"

export function PdfSignerView() {
    const [keys, setKeys] = React.useState<AttestationKey[]>([])
    const [selectedKeyId, setSelectedKeyId] = React.useState<string>("")
    const [processing, setProcessing] = React.useState(false)
    const [signedPdf, setSignedPdf] = React.useState<Uint8Array | null>(null)
    const [fileName, setFileName] = React.useState<string>("")

    const { openFilePicker, filesContent, loading, clear } = useFilePicker({
        readAs: 'ArrayBuffer',
        accept: '.pdf',
        multiple: false,
    });

    React.useEffect(() => {
        const loadedKeys = AttestationStorage.getKeys();
        setKeys(loadedKeys);
        if (loadedKeys.length > 0) {
            setSelectedKeyId(loadedKeys[0].id);
        }
    }, []);

    // Effect to handle file selection
    React.useEffect(() => {
        if (filesContent && filesContent.length > 0) {
            setSignedPdf(null);
            setFileName(filesContent[0].name);
        }
    }, [filesContent]);

    const handleSign = async () => {
        if (!filesContent || filesContent.length === 0) return;
        if (!selectedKeyId) {
            toast.error("Please select a signing identity");
            return;
        }

        setProcessing(true);
        try {
            const key = keys.find(k => k.id === selectedKeyId);
            if (!key) throw new Error("Key not found");

            const masterKey = masterKeyManager.getMasterKey();
            if (!masterKey) throw new Error("Master key not found");

            const fileContent = filesContent[0].content as ArrayBuffer;
            const pdfBytes = new Uint8Array(fileContent);

            const signedBytes = await signPdf(pdfBytes, key, masterKey);
            setSignedPdf(signedBytes);
            toast.success("Document signed successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Signing failed: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setProcessing(false);
        }
    }

    const handleDownload = () => {
        if (!signedPdf) return;
        const blob = new Blob([signedPdf as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `signed-${fileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Sign Document</CardTitle>
                <CardDescription>
                    Select a PDF file and identity to apply a cryptographic signature.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>1. Select Document</Label>
                    <div
                        onClick={() => openFilePicker()}
                        className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                        {filesContent && filesContent.length > 0 ? (
                            <div className="flex flex-col items-center gap-2">
                                <IconFile className="size-8 text-primary" />
                                <span className="font-medium">{filesContent[0].name}</span>
                                <span className="text-xs text-muted-foreground">Click to change file</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <IconUpload className="size-8" />
                                <span>Click to upload PDF</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>2. Select Signing Identity</Label>
                    <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select an identity" />
                        </SelectTrigger>
                        <SelectContent>
                            {keys.map((key) => (
                                <SelectItem key={key.id} value={key.id}>
                                    {key.name} ({key.id.slice(0, 8)}...)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {keys.length === 0 && (
                        <p className="text-xs text-destructive">
                            You need to create an identity in the "Manage Keys" tab first.
                        </p>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => clear()}>Clear</Button>
                {signedPdf ? (
                    <Button onClick={handleDownload} className="gap-2">
                        <IconCheck className="size-4" /> Download Signed PDF
                    </Button>
                ) : (
                    <Button
                        onClick={handleSign}
                        disabled={processing || loading || !filesContent.length || !selectedKeyId}
                    >
                        {processing ? "Signing..." : "Sign Document"}
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
