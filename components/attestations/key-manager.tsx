"use client"

import * as React from "react"
import {
    IconShieldLock,
    IconTrash,
    IconDownload,
    IconKey,
    IconLoader2,
    IconDotsVertical,
    IconSearch,
    IconAlertCircle,
    IconLock,
    IconLockOpen,
    IconPlus,
    IconAlertTriangle,
    IconBan
} from "@tabler/icons-react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { generateAttestationKeypair, encryptPrivateKey, encryptString, decryptString, decryptPrivateKeyAsString } from "@/lib/attestations/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { useUser } from "@/components/user-context"
import { apiClient as api } from "@/lib/api"
import { cn } from "@/lib/utils"

interface AttestationKey {
    id: string
    name: string
    publicKey: string // PEM
    encryptedPrivateKey: string // PEM (encrypted)
    createdAt: string
    revokedAt?: string | null
}

export function KeyManager() {
    const [keys, setKeys] = React.useState<AttestationKey[]>([])
    const [loading, setLoading] = React.useState(false)
    const [isCreateOpen, setIsCreateOpen] = React.useState(false)
    const [newKeyName, setNewKeyName] = React.useState("")
    const [searchQuery, setSearchQuery] = React.useState("")
    const { user } = useUser()

    // Key to revoke
    const [keyToRevoke, setKeyToRevoke] = React.useState<AttestationKey | null>(null)
    const [isRevokeDialogOpen, setIsRevokeDialogOpen] = React.useState(false)

    // Key to delete
    const [keyToDelete, setKeyToDelete] = React.useState<AttestationKey | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

    React.useEffect(() => {
        loadKeys()
    }, [])

    const loadKeys = async () => {
        setLoading(true);
        try {
            const masterKey = masterKeyManager.getMasterKey();
            if (!masterKey) return; // Wait for master key or user login

            const response = await api.getAttestationKeys();

            if (response.success && response.data) {
                const keysData = response.data;
                // Decrypt names
                const decryptedKeys = await Promise.all(keysData.map(async (k: any) => {
                    try {
                        const decryptedName = await decryptString(k.name, masterKey);
                        return { ...k, name: decryptedName };
                    } catch (e) {
                        console.error("Failed to decrypt key name", e);
                        return { ...k, name: "Decryption Failed" };
                    }
                }));
                setKeys(decryptedKeys);
            }
        } catch (error) {
            console.error("Failed to load keys", error);
            toast.error("Failed to load keys");
        } finally {
            setLoading(false);
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
            const encryptedPrivateKey = await encryptPrivateKey(privateKeyPem, masterKey);
            const encryptedName = await encryptString(newKeyName, masterKey);

            // 3. Send to backend
            const response = await api.createAttestationKey({
                encryptedName,
                publicKey: certPem,
                encryptedPrivateKey
            });

            if (response.success) {
                loadKeys();
                setIsCreateOpen(false);
                setNewKeyName("");
                toast.success("Identity key generated successfully");
            } else {
                toast.error(response.error || "Failed to create identity");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate key: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setLoading(false);
        }
    }

    const handleRevokeKey = async () => {
        if (!keyToRevoke) return;
        try {
            const response = await api.revokeAttestationKey(keyToRevoke.id, "User requested revocation");
            if (response.success) {
                toast.success("Key revoked successfully");
                loadKeys();
                setIsRevokeDialogOpen(false);
                setKeyToRevoke(null);
            } else {
                toast.error(response.error || "Failed to revoke key");
            }
        } catch (error) {
            toast.error("Failed to revoke key");
        }
    }

    const handleDeleteKey = async () => {
        if (!keyToDelete) return;
        try {
            const response = await api.deleteAttestationKey(keyToDelete.id);
            if (response.success) {
                toast.success("Key deleted permanently");
                loadKeys();
                setIsDeleteDialogOpen(false);
                setKeyToDelete(null);
            } else {
                toast.error(response.error || "Failed to delete key");
            }
        } catch (error) {
            toast.error("Failed to delete key");
        }
    }

    const downloadFile = (filename: string, content: string, type: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${type}`);
    }

    const downloadPrivate = async (key: AttestationKey) => {
        try {
            const masterKey = masterKeyManager.getMasterKey();
            if (!masterKey) throw new Error("No master key");

            let privateKeyContent = key.encryptedPrivateKey;
            try {
                // Decrypt the private key using the master key
                // The encryptedPrivateKey is stored as "nonce:ciphertext"
                privateKeyContent = await decryptPrivateKeyAsString(key.encryptedPrivateKey, masterKey);
            } catch (decryptError) {
                console.error("Failed to decrypt private key for export:", decryptError);
                toast.error("Failed to decrypt private key. Exporting encrypted version instead.");
            }

            downloadFile(`${key.name.replace(/\s+/g, '_')}_private.pem`, privateKeyContent, "Private Key (Unencrypted)");
            toast.info("Exported Private Key (DECRYPTED - handle with care!)");
        } catch (e) {
            toast.error("Failed to export private key");
        }
    }

    const filteredKeys = keys.filter(k =>
        k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium">Signing Identities</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your digital identities used for signing documents.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search keys..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="h-9">
                                <IconPlus className="mr-2 size-4" />
                                Create Identity
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Identity</DialogTitle>
                                <DialogDescription>
                                    Generate a new cryptographic keypair and self-signed certificate.
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
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[300px]">Identity Name</TableHead>
                            <TableHead>Key ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredKeys.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <IconLoader2 className="size-4 animate-spin" />
                                            Loading keys...
                                        </div>
                                    ) : (
                                        "No identities found"
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredKeys.map((key) => {
                                const isRevoked = !!key.revokedAt;
                                return (
                                    <TableRow key={key.id} className={isRevoked ? "bg-muted/30" : ""}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2 rounded-full bg-muted", isRevoked && "opacity-50")}>
                                                    <IconKey className="size-4 text-foreground" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={cn(isRevoked && "text-muted-foreground line-through")}>{key.name}</span>
                                                    {isRevoked && <span className="text-xs text-destructive font-medium">Revoked</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded w-fit">
                                                <span>{key.id.slice(0, 8)}...{key.id.slice(-4)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isRevoked ? (
                                                <div className="inline-flex items-center rounded-full border border-destructive/50 px-2.5 py-0.5 text-xs font-semibold text-destructive transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                                    Revoked
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center rounded-full border border-transparent bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:bg-emerald-500/25 dark:text-emerald-400">
                                                    Active
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(key.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <IconDotsVertical className="size-4" />
                                                        <span className="sr-only">Open menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[160px]">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => downloadFile(`${key.name.replace(/\s+/g, '_')}.crt`, key.publicKey, "Public Certificate")}>
                                                        <IconDownload className="mr-2 size-4" /> Export Public
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => downloadPrivate(key)}>
                                                        <IconLock className="mr-2 size-4" /> Export Private
                                                    </DropdownMenuItem>

                                                    {!isRevoked && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/20"
                                                                onClick={() => {
                                                                    setKeyToRevoke(key);
                                                                    setIsRevokeDialogOpen(true);
                                                                }}
                                                            >
                                                                <IconBan className="mr-2 size-4" /> Revoke
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}

                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                        onClick={() => {
                                                            setKeyToDelete(key);
                                                            setIsDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <IconTrash className="mr-2 size-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Revoke Dialog */}
            <AlertDialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Identity?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the identity <strong>{keyToRevoke?.name}</strong> as revoked.
                            You will no longer be able to use it for signing, but existing signatures can still be verified against the timestamp date.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRevokeKey}
                            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
                        >
                            Revoke Identity
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Identity Permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{keyToDelete?.name}</strong>?
                            <br /><br />
                            <span className="font-bold text-destructive">Warning:</span> Signatures made with this key will become unverifiable if you lose the public key.
                            This action is permanent and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteKey}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
