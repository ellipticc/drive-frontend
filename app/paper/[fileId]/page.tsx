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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function PaperPage() {
    const params = useParams();
    const router = useRouter();
    const fileId = params.fileId as string;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isUnsaved, setIsUnsaved] = useState(false);
    const [content, setContent] = useState<Value | undefined>(undefined);
    const [paperTitle, setPaperTitle] = useState<string>("Untitled Paper");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const latestContentRef = useRef<Value | undefined>(undefined);
    const lastSavedContentRef = useRef<string>("");
    const lastChangeTimeRef = useRef<number>(0);

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

                let loadedContent: Value;
                const rawContent = paper.content;

                if (Array.isArray(rawContent) && rawContent.length > 0) {
                    // Check if first element is valid (has children or is a known type)
                    if (rawContent[0] && typeof rawContent[0] === 'object' && 'children' in rawContent[0]) {
                        loadedContent = rawContent as Value;
                    } else {
                        loadedContent = [{ type: 'p', children: [{ text: '' }] }];
                    }
                } else if (typeof rawContent === 'string' && rawContent.trim() !== '') {
                    loadedContent = [{ type: 'p', children: [{ text: rawContent }] }];
                } else if (rawContent && typeof rawContent === 'object' && 'children' in rawContent) {
                    // Single node fallback
                    loadedContent = [rawContent] as unknown as Value;
                } else {
                    // Fallback for {}, empty array, null, or invalid structure
                    loadedContent = [{ type: 'p', children: [{ text: '' }] }];
                }

                setContent(loadedContent);
                latestContentRef.current = loadedContent;
                lastSavedContentRef.current = JSON.stringify(loadedContent);

            } catch (error) {
                console.error("Error loading paper:", error);
                toast.error("Failed to load paper.");
            } finally {
                setLoading(false);
            }
        };

        loadFile();
    }, [fileId, router]);

    // Save Logic (Content)
    const handleSave = useCallback(async (newValue: Value) => {
        const contentString = JSON.stringify(newValue);
        // Prevent unnecessary saves if strictly identical to last save AND we know we are cleaner
        if (contentString === lastSavedContentRef.current) {
            setIsUnsaved(false); // Ensure status is correct
            return;
        }

        const saveStartTime = Date.now();
        setSaving(true);
        try {
            if (!masterKeyManager.hasMasterKey()) return;
            await paperService.savePaper(fileId, newValue);

            // Only mark as clean if no new changes occurred during save
            if (lastChangeTimeRef.current <= saveStartTime) {
                setIsUnsaved(false);
                lastSavedContentRef.current = contentString;
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to save content");
        } finally {
            setSaving(false);
        }
    }, [fileId]);

    // Save Logic (Title)
    const handleTitleSave = async (newTitle: string) => {
        if (newTitle.trim() === paperTitle) {
            setIsEditingTitle(false);
            return;
        }

        try {
            if (!masterKeyManager.hasMasterKey()) return;
            // Pass undefined for content to only update title
            await paperService.savePaper(fileId, undefined, newTitle);
            setPaperTitle(newTitle);
        } catch (e) {
            console.error(e);
            toast.error("Failed to save title");
        } finally {
            setIsEditingTitle(false);
        }
    };

    // Auto-save debounce
    const onChange = (newValue: Value) => {
        latestContentRef.current = newValue;
        lastChangeTimeRef.current = Date.now();
        setIsUnsaved(true);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            handleSave(newValue);
        }, 2000);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (latestContentRef.current) {
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    handleSave(latestContentRef.current);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // Focus input when editing title starts
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);


    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <IconLoader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="flex flex-col flex-1 bg-background overflow-hidden">
                <header className="flex h-14 items-center gap-4 border-b px-4 shrink-0 bg-background z-10">
                    <div className="flex items-center gap-2 max-w-xl">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="hover:bg-muted">
                            <IconArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-primary font-bold text-xs">P</span>
                        </div>

                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                defaultValue={paperTitle}
                                className="text-lg font-semibold bg-transparent border-b border-primary focus:outline-none w-full min-w-[200px]"
                                onBlur={(e) => handleTitleSave(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleTitleSave(e.currentTarget.value);
                                    }
                                }}
                            />
                        ) : (
                            <h1
                                className="text-lg font-semibold truncate cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                                onDoubleClick={() => setIsEditingTitle(true)}
                                title="Double click to rename"
                            >
                                {paperTitle}
                            </h1>
                        )}
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[80px] justify-end">
                            {saving ? (
                                <>
                                    <IconLoader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : isUnsaved ? (
                                <span className="text-muted-foreground/70">Unsaved</span>
                            ) : (
                                <>
                                    <IconCloudCheck className="w-4 h-4 text-green-500" />
                                    <span className="text-green-500 font-medium">Saved</span>
                                </>
                            )}
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1 rounded bg-muted/50 hidden md:block cursor-help hover:bg-muted transition-colors">
                                    Zero-Knowledge Encrypted
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs">Your content is encrypted with your private key before leaving your device. Only you can read it.</p>
                            </TooltipContent>
                        </Tooltip>
                        <ThemeToggle />
                    </div>
                </header>

                <main className="flex-1 overflow-hidden relative">
                    <PlateEditor initialValue={content} onChange={onChange} />
                </main>
            </div>
        </div>
    );
}
