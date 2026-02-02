"use client"

import * as React from "react"
import {
    IconPlus,
    IconTrash,
    IconDownload,
    IconKey,
    IconLoader2,
    IconExternalLink
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { generateAttestationKeypair, encryptPrivateKey, encryptString, decryptString } from "@/lib/attestations/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { useUser } from "@/components/user-context"
import { apiClient } from "@/lib/api-service"

interface AttestationKey {
    id: string
    name: string
    publicKey: string // PEM
    encryptedPrivateKey: string // PEM (encrypted)
    createdAt: string
}

export function KeyManager() {
    const [keys, setKeys] = React.useState<AttestationKey[]>([])
    const [loading, setLoading] = React.useState(false)
    const [isCreateOpen, setIsCreateOpen] = React.useState(false)
    const [newKeyName, setNewKeyName] = React.useState("")
    const { user } = useUser()

    React.useEffect(() => {
        loadKeys()
    }, [])

    const loadKeys = async () => {
        try {
            const masterKey = masterKeyManager.getMasterKey();
            if (!masterKey) return; // Wait for master key or user login

            const keysData = await apiClient.get<AttestationKey[]>("/attestations/keys");

            // Decrypt names
            const decryptedKeys = await Promise.all(keysData.map(async (k) => {
                try {
                    const decryptedName = await decryptString(k.name, masterKey); // k.name is encrypted from backend
                    return { ...k, name: decryptedName };
                } catch (e) {
                    console.error("Failed to decrypt key name", e);
                    return { ...k, name: "Decryption Failed" };
                }
            }));

            setKeys(decryptedKeys);
        } catch (error) {
            console.error("Failed to load keys", error);
        }
    }

    const handleCreateKey = async () => {
        if (!newKeyName || !user) return;
        if (newKeyName.length > 100) {
            toast.error("Key name must be 100 characters or less");
            return;
        }

        setLoading(true);
        try {
            const masterKey = masterKeyManager.getMasterKey();
            if (!masterKey) {
                throw new Error("Master key not found. Please log in again.");
            }

            // 1. Generate local keypair
            const { privateKeyPem, publicKeyPem, certPem } = await generateAttestationKeypair(
                newKeyName,
                user.id,
                "Ellipticc Drive"
            );

            // 2. Encrypt private key & name with master key
            // Using logic from crypto.ts (requires helpers)
            const encryptedPrivateKey = await encryptPrivateKey(privateKeyPem, masterKey);
            const encryptedName = await encryptString(newKeyName, masterKey);

            // 3. Send to backend
            await apiClient.post("/attestations/keys", {
                encryptedName,
                publicKey: certPem,
                encryptedPrivateKey
            });

            loadKeys();
            setIsCreateOpen(false);
            setNewKeyName("");
            toast.success("Identity key generated successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate key: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteKey = async (id: string) => {
        if (confirm("Are you sure you want to delete this key? Access to signed documents may be affected.")) {
            try {
                await apiClient.delete(`/attestations/keys/${id}`);
                loadKeys();
                toast.success("Key deleted");
            } catch (error) {
                toast.error("Failed to delete key");
            }
        }
    }

    const downloadFile = (filename: string, content: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Signing Identities</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your digital identities used for signing documents.
                    </p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <IconPlus className="mr-2 size-4" />
                            Create Identity
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Identity</DialogTitle>
                            <DialogDescription>
                                Generate a new cryptographic keypair and self-signed certificate for signing documents.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Identity Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Work Identity, Personal Key"
                                    value={newKeyName}
                                    maxLength={100}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newKeyName) {
                                            handleCreateKey();
                                        }
                                    }}
                                />
                                <div className="text-xs text-muted-foreground text-right">{newKeyName.length}/100</div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateKey} disabled={loading || !newKeyName}>
                                {loading && <IconLoader2 className="mr-2 size-4 animate-spin" />}
                                {loading ? "Generating..." : "Create Identity"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Certificate ID</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keys.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No identities found. Create one to start signing documents.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                keys.map((key) => (
                                    <TableRow key={key.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <IconKey className="size-4 text-muted-foreground" />
                                                {key.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {key.id.slice(0, 8)}...
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Download Certificate"
                                                    onClick={() => downloadFile(`${key.name.replace(/\s+/g, '_')}.crt`, key.publicKey)}
                                                >
                                                    <IconDownload className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Delete"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteKey(key.id)}
                                                >
                                                    <IconTrash className="size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
