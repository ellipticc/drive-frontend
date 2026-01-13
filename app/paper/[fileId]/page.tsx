"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PlateEditor } from "@/components/plate-editor";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconArrowLeft, IconCloudCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type Value } from "platejs";
import { paperService } from "@/lib/paper-service";

export default function PaperPage() {
    const params = useParams();
    const router = useRouter();
    const fileId = params.fileId as string;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [content, setContent] = useState<Value | undefined>(undefined);
    const [paperTitle, setPaperTitle] = useState<string>("Untitled Paper");
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

                // Fetch paper using new internal service
                const paper = await paperService.getPaper(fileId);

                setPaperTitle(paper.title);
                if (paper.content && Array.isArray(paper.content)) {
                    setContent(paper.content as Value);
                } else if (paper.content && typeof paper.content === 'object') {
                    // Handle edge case where content might be object but not array (Plate expects Value aka TElement[])
                    setContent([paper.content] as unknown as Value);
                } else if (typeof paper.content === 'string') {
                    // Legacy or plain text fallback
                    setContent([{ children: [{ text: paper.content }], type: 'p' }]);
                } else if (!paper.content || Object.keys(paper.content).length === 0) {
                    // Empty content
                    setContent(undefined);
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

            // Save using internal service (no keypairs needed anymore)
            await paperService.savePaper(fileId, newValue);

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
                    <h1 className="text-lg font-semibold truncate max-w-md">{paperTitle}</h1>
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
