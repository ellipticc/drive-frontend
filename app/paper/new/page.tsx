"use client";

import React from 'react';
import { PlateEditor } from '@/components/plate-editor';
import { Toaster } from 'sonner';

export default function NewPaperPage() {
    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="flex h-14 items-center gap-4 border-b px-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">P</span>
                    </div>
                    <h1 className="font-semibold text-sm">Untitled Paper</h1>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1 rounded bg-muted/50">
                        Zero-Knowledge Encrypted
                    </span>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl mx-auto h-full">
                    <PlateEditor />
                </div>
            </main>

            <Toaster />
        </div>
    );
}
