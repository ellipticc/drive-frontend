"use client"

import * as React from "react"
import { IconFile, IconUpload, IconCheck, IconAlertCircle, IconDeviceFloppy } from "@tabler/icons-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"

import { signPdf } from "@/lib/attestations/pdf-signer"
import { masterKeyManager } from "@/lib/master-key"
import { decryptString } from "@/lib/attestations/crypto"
import { apiClient as api } from "@/lib/api"
import { uploadEncryptedFile } from "@/lib/upload"

export function PdfSignerView() {
    const [keys, setKeys] = React.useState<any[]>([])
    const [selectedKeyId, setSelectedKeyId] = React.useState<string>("")
    const [processing, setProcessing] = React.useState(false)
    const [signedPdf, setSignedPdf] = React.useState<Uint8Array | null>(null)
    const [fileName, setFileName] = React.useState<string>("")
    const [timestampResult, setTimestampResult] = React.useState<any | null>(null)
    const [loadingKeys, setLoadingKeys] = React.useState(false)
    const [proofReason, setProofReason] = React.useState("")
    const [proofLocation, setProofLocation] = React.useState("")
    const [isUploading, setIsUploading] = React.useState(false)

    const { openFilePicker, filesContent, loading, clear } = useFilePicker({
        readAs: 'ArrayBuffer',
        accept: '.pdf',
        multiple: false,
    });

    React.useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = async () => {
        setLoadingKeys(true);
        try {
            const masterKey = masterKeyManager.getMasterKey();
            if (!masterKey) return;

            const response = await api.getAttestationKeys();
            if (response.success && response.data) {
                const decryptedKeys = await Promise.all(response.data.map(async (k: any) => {
                    try {
                        const decryptedName = await decryptString(k.name, masterKey);
                        return { ...k, name: decryptedName };
                    } catch (e) {
                        return { ...k, name: "Decryption Failed" };
                    }
                }));

                const activeKeys = decryptedKeys.filter(k => !k.revokedAt);
                setKeys(activeKeys);

                if (activeKeys.length > 0) {
                    setSelectedKeyId(activeKeys[0].id);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load signing identities");
        } finally {
            setLoadingKeys(false);
        }
    }

    // Effect to handle file selection
    React.useEffect(() => {
        if (filesContent && filesContent.length > 0) {
            setSignedPdf(null);
            setTimestampResult(null);
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

            const result = await signPdf(pdfBytes, key, masterKey);
            setSignedPdf(result.pdfBytes);

            if (result.timestampData) {
                setTimestampResult({
                    data: result.timestampData,
                    verification: result.timestampVerification
                });
                if (result.timestampVerification?.verified) {
                    toast.success("Document signed and timestamped successfully!");
                } else {
                    toast.warning("Document signed, but timestamp verification pending/failed.");
                }
            } else {
                toast.success("Document signed successfully (no timestamp).");
            }
        } catch (error) {
            console.error(error);
            toast.error("Signing failed: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setProcessing(false);
        }
    }

    const handleSaveAttestation = async () => {
        if (!signedPdf || !fileName || !selectedKeyId) return;

        setIsUploading(true);
        const toastId = toast.loading("Saving attestation document...");

        try {
            const signedFile = new File([signedPdf as any], fileName, { type: 'application/pdf' });

            // Upload as hidden file with attestation metadata
            await uploadEncryptedFile(
                signedFile,
                null, // root folder (doesn't matter as it's hidden)
                undefined,
                undefined,
                undefined,
                undefined,
                'skip', // conflict resolution
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                true, // isHidden
                {
                    keyId: selectedKeyId,
                    reason: proofReason,
                    location: proofLocation
                }
            );

            toast.success("Document saved to Attestations", { id: toastId });

            // Reset state
            setSignedPdf(null);
            setTimestampResult(null);
            clear();
            setProofReason("");
            setProofLocation("");
        } catch (error) {
            console.error("Save failed:", error);
            toast.error("Failed to save attestation document", { id: toastId });
        } finally {
            setIsUploading(false);
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
                        onClick={() => !signedPdf && openFilePicker()}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${signedPdf ? 'bg-muted/30 cursor-default border-solid' : 'hover:bg-muted/50 cursor-pointer'}`}
                    >
                        {filesContent && filesContent.length > 0 ? (
                            <div className="flex flex-col items-center gap-2">
                                <IconFile className="size-8 text-primary" />
                                <span className="font-medium">{filesContent[0].name}</span>
                                {!signedPdf && <span className="text-xs text-muted-foreground">Click to change file</span>}
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
                    <Select value={selectedKeyId} onValueChange={setSelectedKeyId} disabled={loadingKeys || keys.length === 0 || !!signedPdf}>
                        <SelectTrigger>
                            <SelectValue placeholder={loadingKeys ? "Loading identities..." : "Select an identity"} />
                        </SelectTrigger>
                        <SelectContent>
                            {keys.map((key) => (
                                <SelectItem key={key.id} value={key.id}>
                                    {key.name} ({key.id.slice(0, 8)}...)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {!loadingKeys && keys.length === 0 && (
                        <Alert variant="destructive" className="mt-2">
                            <IconAlertCircle className="h-4 w-4" />
                            <AlertTitle>No Active Identities</AlertTitle>
                            <AlertDescription>
                                You need to create a valid identity in "Manage Keys" to sign documents.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Reason (Optional)</Label>
                        <Input
                            placeholder="e.g. I approve this document"
                            value={proofReason}
                            onChange={(e) => setProofReason(e.target.value)}
                            disabled={!!signedPdf}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Location (Optional)</Label>
                        <Input
                            placeholder="e.g. Zurich, Switzerland"
                            value={proofLocation}
                            onChange={(e) => setProofLocation(e.target.value)}
                            disabled={!!signedPdf}
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => {
                    clear();
                    setSignedPdf(null);
                    setTimestampResult(null);
                    setProofReason("");
                    setProofLocation("");
                }} disabled={isUploading}>Clear</Button>

                {signedPdf ? (
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleDownload} disabled={isUploading}>
                            Download PDF
                        </Button>
                        <Button onClick={handleSaveAttestation} disabled={isUploading} className="gap-2">
                            {isUploading ? "Saving..." : <><IconDeviceFloppy className="size-4" /> Save Attestation</>}
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={handleSign}
                        disabled={processing || loading || !filesContent.length || !selectedKeyId}
                    >
                        {processing ? "Signing..." : "Sign Document"}
                    </Button>
                )}

            </CardFooter>

            {
                timestampResult && timestampResult.verification && (
                    <div className="border-t p-6 bg-muted/20">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-green-500/10 p-2 rounded-full">
                                <IconCheck className="size-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">RFC 3161 Timestamp Applied</h3>
                                <p className="text-xs text-muted-foreground">The signature includes a trusted timestamp.</p>
                            </div>
                        </div>

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-background p-4 rounded-lg border">
                            <div>
                                <dt className="text-muted-foreground text-xs">Time</dt>
                                <dd className="font-medium">
                                    {timestampResult.verification.genTime
                                        ? new Date(timestampResult.verification.genTime).toLocaleString()
                                        : "Unknown"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs">TSA Signer</dt>
                                <dd className="font-medium truncate" title={timestampResult.verification.tsaSigner?.subject?.commonName || timestampResult.verification.tsaSigner?.commonName}>
                                    {timestampResult.verification.tsaSigner?.subject?.commonName || timestampResult.verification.tsaSigner?.commonName || "Unknown"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs">Authority</dt>
                                <dd className="font-medium mb-1">
                                    {timestampResult.verification.tsaCertChainValidated ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                            Trusted
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                                            Untrusted Chain
                                        </span>
                                    )}
                                </dd>
                            </div>

                        </dl>
                    </div>
                )
            }
        </Card >
    )
}
