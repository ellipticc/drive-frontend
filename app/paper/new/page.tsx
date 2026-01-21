"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from "next/navigation";
import { PlateEditor } from '@/components/plate-editor';
import { Toaster, toast } from 'sonner';
import { IconLoader2, IconArrowLeft, IconCloudCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { masterKeyManager } from "@/lib/master-key";
import { paperService } from "@/lib/paper-service";
import { type Value } from "platejs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { HeaderUser } from "@/components/header-user";

export default function NewPaperPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const creatingMode = !!searchParams && searchParams.get('creating') === '1';

    // If opened by the quick-create flow, show a minimal loading UI while the opener creates the paper
    if (creatingMode) {
        return (
            <div className="flex items-center justify-center h-screen w-full bg-background">
                <div className="text-center">
                    <IconLoader2 className="w-10 h-10 animate-spin text-muted-foreground mx-auto" />
                    <p className="mt-4 text-lg font-semibold">Loading your fantastic work…</p>
                </div>
            </div>
        );
    }

    const handleInitialSave = useCallback(async (newValue: Value) => {
        if (saving) return; // Prevent double trigger
        setSaving(true);
        try {
            if (!masterKeyManager.hasMasterKey()) {
                toast.error("Encryption key missing. Please login.");
                router.push('/login');
                return;
            }

            const now = new Date();
            // Format: Untitled paper YYYY-MM-DD HH.MM.SS
            const pad = (n: number) => n.toString().padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const timeStr = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
            const filename = `Untitled paper ${dateStr} ${timeStr}`;

            // Create paper using new internal service (no keypairs needed)
            // Passing null for folderId (root)
            const fileId = await paperService.createPaper(filename, newValue, null);

            // Redirect to the newly created paper
            router.replace(`/paper?fileId=${fileId}`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to create paper");
            setSaving(false);
        }
    }, [router, saving]);

    // Auto-save debounce
    const onChange = (newValue: Value) => {
        // Only trigger if there is actual content
        const text = (newValue?.[0]?.children?.[0] as { text?: string })?.text;
        if (typeof text !== 'string' || text.trim() === '') return;

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            handleInitialSave(newValue);
        }, 1500);
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="flex h-14 items-center gap-4 border-b px-6 shrink-0 bg-background rounded-tl-lg rounded-bl-lg">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                        <IconArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">P</span>
                    </div>
                    <h1 className="font-semibold text-sm">New Paper</h1>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {saving ? (
                            <>
                                <IconLoader2 className="w-4 h-4 animate-spin" />
                                <span>Creating...</span>
                            </>
                        ) : (
                            <>
                                <IconCloudCheck className="w-4 h-4" />
                                <span>Draft</span>
                            </>
                        )}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1 rounded bg-muted/50 hidden md:block">
                        Zero-Knowledge Encrypted
                    </span>
                    <ThemeToggle />
                    <div className="h-6 w-px bg-border mx-1" />
                    <HeaderUser />
                </div>
            </header>

            <main className="flex-1 overflow-hidden">
                <PlateEditor onChange={onChange} />
            </main>

            <Toaster />
        </div>
    );
}
