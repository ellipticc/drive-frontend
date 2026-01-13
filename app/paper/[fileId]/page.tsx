"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PlateEditor } from "@/components/plate-editor";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconArrowLeft, IconCloudCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type Value } from "platejs";
import { downloadEncryptedFile } from "@/lib/download";
import { keyManager } from "@/lib/key-manager";
import { paperService } from "@/lib/paper-service";

export default function PaperPage() {
    const params = useParams();
    const router = useRouter();
    const fileId = params.fileId as string;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [content, setContent] = useState<Value | undefined>(undefined);
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Initial Load
    useEffect(() => {
        const loadFile = async () => {
            try {
                if (!masterKeyManager.hasMasterKey()) {
                    toast.error("Encryption key missing. Please login again.");
                    router.push("/login");
                    return;
                }

                // Fetch file content using standard downloadEncryptedFile
                const userKeys = await keyManager.getUserKeys();
                const controller = new AbortController(); // or use a ref if we want to cancel

                const result = await downloadEncryptedFile(fileId, userKeys, undefined, controller.signal);

                const blob = result.blob;
                const arrayBuffer = await blob.arrayBuffer();

                const jsonStr = new TextDecoder().decode(arrayBuffer);
                try {
                    const json = JSON.parse(jsonStr);
                    setContent(json);
                } catch {
                    setContent([{ children: [{ text: jsonStr }], type: 'p' }]);
                }

            } catch (error) {
                console.error("Error loading paper:", error);
                toast.error("Failed to load paper.");
            } finally {
                setLoading(false);
            }
        };

        loadFile();
    }, [fileId, router]);

    const handleSave = useCallback(async (newValue: Value) => {
        setSaving(true);
        try {
            if (!masterKeyManager.hasMasterKey()) return;

            // Get user PQC keys for re-encryption (key rotation support)
            const userKeys = await keyManager.getUserKeys();
            if (!userKeys || !userKeys.keypairs) {
                toast.error("Encryption keys missing. Please reload.");
                return;
            }

            await paperService.savePaper(fileId, newValue, userKeys.keypairs);

        } catch (e) {
            console.error(e);
            toast.error("Failed to save");
        } finally {
            setSaving(false);
        }
    }, [fileId]);

    // Auto-save debounce
    const onChange = (newValue: Value) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            handleSave(newValue);
        }, 2000);
    };

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <IconLoader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="flex h-14 items-center gap-4 border-b px-6 shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                        <IconArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">P</span>
                    </div>
                    <h1 className="text-lg font-semibold truncate max-w-md">Paper</h1>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {saving ? (
                            <>
                                <IconLoader2 className="w-4 h-4 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <IconCloudCheck className="w-4 h-4" />
                                <span>Saved</span>
                            </>
                        )}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1 rounded bg-muted/50 hidden md:block">
                        Zero-Knowledge Encrypted
                    </span>
                </div>
            </header>
            <main className="flex-1 overflow-hidden">
                <PlateEditor initialValue={content} onChange={onChange} />
            </main>
        </div>
    );
}
