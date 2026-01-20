"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconArrowLeft, IconCloudCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { type Value } from "platejs";
import { paperService } from "@/lib/paper-service";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HeaderUser } from "@/components/header-user";
import { Input } from "@/components/ui/input";
import { Plate, usePlateEditor } from "platejs/react";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { EditorKit } from "@/components/editor-kit";
import { useEmojiDropdownMenuState } from "@platejs/emoji/react";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { FixedToolbarButtons } from "@/components/ui/fixed-toolbar-buttons";
import { EmojiPopover, EmojiPicker } from "@/components/ui/emoji-toolbar-button";
import { VersionHistoryModal } from "@/components/modals/version-history-modal";
import { IconHistory } from "@tabler/icons-react";

interface PaperHeaderProps {
    fileId: string;
    paperTitle: string;
    setPaperTitle: (title: string) => void;
    handleTitleSave: (title: string) => void;
    icon: string | null;
    onSelectEmoji: (emoji: any) => void;
    saving: boolean;
    isUnsaved: boolean;
    setHistoryOpen: (open: boolean) => void;
    onBack: () => void;
}

function PaperHeader({
    fileId,
    paperTitle,
    setPaperTitle,
    handleTitleSave,
    icon,
    onSelectEmoji,
    saving,
    isUnsaved,
    setHistoryOpen,
    onBack
}: PaperHeaderProps) {
    const router = useRouter();
    const { emojiPickerState, isOpen, setIsOpen } = useEmojiDropdownMenuState();

    // Determine display icon (emoji or first letter)
    const displayIcon = icon || (paperTitle ? paperTitle.charAt(0).toUpperCase() : "U");

    return (
        <header className="flex h-16 items-center gap-4 border-b px-6 shrink-0 bg-background z-50">
            <div className="flex items-center gap-3 w-full max-w-2xl">
                <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-muted shrink-0">
                    <IconArrowLeft className="w-5 h-5" />
                </Button>

                <EmojiPopover
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    control={
                        <Button
                            variant="ghost"
                            className="w-8 h-8 rounded-md bg-transparent flex items-center justify-center shrink-0 hover:bg-muted p-0 text-lg overflow-hidden"
                        >
                            {displayIcon}
                        </Button>
                    }
                >
                    <EmojiPicker
                        {...emojiPickerState}
                        isOpen={isOpen}
                        setIsOpen={setIsOpen}
                        onSelectEmoji={(emoji) => {
                            onSelectEmoji(emoji);
                            setIsOpen(false);
                        }}
                    />
                </EmojiPopover>

                <Input
                    value={paperTitle}
                    onChange={(e) => setPaperTitle(e.target.value)}
                    onBlur={(e) => handleTitleSave(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur();
                        }
                    }}
                    maxLength={255}
                    className="text-2xl font-semibold bg-transparent border-transparent hover:border-border focus:border-input focus:bg-background transition-colors w-full h-11 px-2 shadow-none truncate"
                    placeholder="Untitled Paper"
                />
            </div>

            <div className="ml-auto flex items-center gap-4 shrink-0">
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
                <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(true)} title="Version History">
                    <IconHistory className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1 rounded bg-muted/50 hidden md:block cursor-help hover:bg-muted transition-colors">
                            Zero-Knowledge Encrypted
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <p>Your paper is encrypted with your private key before leaving your device. Only you can read it.</p>
                    </TooltipContent>
                </Tooltip>
                <ThemeToggle />
                <div className="h-6 w-px bg-border mx-1" />
                <HeaderUser />
            </div>
        </header>
    );
}

function PaperEditorView({
    initialValue,
    onChange,
    fileId,
    paperTitle,
    setPaperTitle,
    handleTitleSave,
    icon,
    onSelectEmoji,
    saving,
    isUnsaved,
    setHistoryOpen,
    onBack
}: {
    initialValue: Value;
    onChange: (value: Value) => void;
    fileId: string;
    paperTitle: string;
    setPaperTitle: (title: string) => void;
    handleTitleSave: (title: string) => void;
    icon: string | null;
    onSelectEmoji: (emoji: any) => void;
    saving: boolean;
    isUnsaved: boolean;
    setHistoryOpen: (open: boolean) => void;
    onBack: () => void;
}) {
    const editor = usePlateEditor({
        plugins: EditorKit,
        value: initialValue,
    });

    return (
        <Plate
            editor={editor}
            onChange={({ value }) => onChange(value)}
        >
            <div className="flex flex-col h-screen bg-background w-full overflow-hidden">
                <PaperHeader
                    fileId={fileId}
                    paperTitle={paperTitle}
                    setPaperTitle={setPaperTitle}
                    handleTitleSave={handleTitleSave}
                    icon={icon}
                    onSelectEmoji={onSelectEmoji}
                    saving={saving}
                    isUnsaved={isUnsaved}
                    setHistoryOpen={setHistoryOpen}
                    onBack={onBack}
                />

                <FixedToolbar className="border-b shrink-0 !relative !top-0">
                    <FixedToolbarButtons />
                </FixedToolbar>

                <main className="flex-1 overflow-hidden relative">
                    <EditorContainer className="h-full w-full overflow-y-auto flex justify-center">
                        <div className="w-full max-w-[850px] px-8 md:px-12">
                            <Editor
                                className="min-h-full w-full py-4 border-none shadow-none focus-visible:ring-0 transition-all"
                                autoFocus
                                placeholder="New Page"
                            />
                        </div>
                    </EditorContainer>
                </main>
            </div>
        </Plate>
    );
}

export default function PaperPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const fileId = searchParams.get('fileId');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isUnsaved, setIsUnsaved] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [content, setContent] = useState<Value | undefined>(undefined);
    const [paperTitle, setPaperTitle] = useState<string>("Untitled Paper");
    const [icon, setIcon] = useState<string | null>(null);
    const [pageAlert, setPageAlert] = useState<{ message: string } | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const latestIconRef = useRef<string | null>(null);

    useEffect(() => {
        latestIconRef.current = icon;
    }, [icon]);

    const lastSavedTitleRef = useRef<string>("Untitled Paper");

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setPageAlert({ message: detail?.message || 'Upgrade required' });
        };
        window.addEventListener('export-requires-upgrade', handler as EventListener);
        return () => window.removeEventListener('export-requires-upgrade', handler as EventListener);
    }, []);

    const latestContentRef = useRef<Value | undefined>(undefined);
    const lastSavedContentRef = useRef<string>("");
    const lastChangeTimeRef = useRef<number>(0);

    // Smart Versioning: 'close' trigger on unmount/tab close
    useEffect(() => {
        if (!fileId) return;
        const handleUnload = () => {
            // Fire and forget
            const data = JSON.stringify({ isManual: false, triggerType: 'close' });
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(`/api/v1/papers/${fileId}/versions`, blob);
        };

        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);

            // Aggressive flush on unmount/route change
            if (latestContentRef.current) {
                const currentData = { content: latestContentRef.current, icon: latestIconRef.current };
                const currentDataStr = JSON.stringify(currentData);

                if (currentDataStr !== lastSavedContentRef.current) {
                    // If we have local changes, save them immediately before snapshotting
                    paperService.savePaper(fileId, currentData)
                        .then(() => paperService.snapshot(fileId, 'close'))
                        .catch(e => {
                            console.error("Final unmount save failed", e);
                            // Still try to snapshot what we have
                            paperService.snapshot(fileId, 'close');
                        });
                } else {
                    // No new changes, just snapshot
                    paperService.snapshot(fileId, 'close').catch(e => console.error("Close snapshot failed", e));
                }
            } else {
                paperService.snapshot(fileId, 'close').catch(e => console.error("Close snapshot failed", e));
            }
        };
    }, [fileId]);

    // Initial Load
    useEffect(() => {
        if (!fileId) {
            setLoading(false);
            return;
        }

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
                lastSavedTitleRef.current = paper.title || "Untitled Paper";
                document.title = paper.title;

                let loadedContent: Value;
                const rawContent = paper.content;
                let loadedIcon: string | null = null;

                // Handle wrapped content (with icon) vs legacy array content
                if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent) && 'content' in rawContent && 'icon' in rawContent) {
                    // It's our new wrapped format
                    loadedContent = (rawContent as any).content;
                    loadedIcon = (rawContent as any).icon;
                } else if (Array.isArray(rawContent) && rawContent.length > 0) {
                    // Check if first element is valid (has children or is a known type)
                    if (rawContent[0] && typeof rawContent[0] === 'object' && 'children' in rawContent[0]) {
                        loadedContent = rawContent as Value;
                    } else {
                        loadedContent = [{ type: 'h1', children: [{ text: '' }] }];
                    }
                } else if (typeof rawContent === 'string' && rawContent.trim() !== '') {
                    loadedContent = [{ type: 'p', children: [{ text: rawContent }] }];
                } else if (rawContent && typeof rawContent === 'object' && 'children' in rawContent) {
                    // Single node fallback
                    loadedContent = [rawContent] as unknown as Value;
                } else {
                    // Fallback for {}, empty array, null, or invalid structure
                    loadedContent = [{ type: 'h1', children: [{ text: '' }] }];
                }

                setContent(loadedContent);
                setIcon(loadedIcon);
                latestContentRef.current = loadedContent;
                lastSavedContentRef.current = JSON.stringify({ content: loadedContent, icon: loadedIcon });

            } catch (error) {
                console.error("Error loading paper:", error);
                toast.error("Failed to load paper.");
            } finally {
                setLoading(false);
            }
        };

        loadFile();
    }, [fileId, router]);

    // Force reload when restore happens
    const handleRestoreComplete = () => {
        window.location.reload();
    };

    // Save Logic (Content + Icon)
    const handleSave = useCallback(async (newValue: Value, newIcon?: string) => {
        if (!fileId) return;
        const currentIcon = newIcon !== undefined ? newIcon : icon;
        const dataToSave = { content: newValue, icon: currentIcon };
        const contentString = JSON.stringify(dataToSave);

        // Prevent unnecessary saves if strictly identical to last save AND we know we are cleaner
        if (contentString === lastSavedContentRef.current) {
            setIsUnsaved(false); // Ensure status is correct
            return;
        }

        const saveStartTime = Date.now();
        setSaving(true);
        try {
            if (!masterKeyManager.hasMasterKey()) return;
            // We save the wrapped object
            await paperService.savePaper(fileId, dataToSave);

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
    }, [fileId, icon]);

    // Save Logic (Title)
    const handleTitleSave = async (newTitle: string) => {
        if (!fileId) return;
        if (newTitle.trim() === lastSavedTitleRef.current || newTitle.trim() === '') {
            return;
        }

        try {
            if (!masterKeyManager.hasMasterKey()) return;
            // Pass undefined for content to only update title
            await paperService.savePaper(fileId, undefined, newTitle);
            setPaperTitle(newTitle);
            lastSavedTitleRef.current = newTitle;
            document.title = newTitle;
        } catch (e) {
            console.error(e);
            toast.error("Failed to save title");
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
        }, 800);
    };

    // Handle Emoji Select
    const onSelectEmoji = (emoji: any) => {
        const newIcon = emoji.skins[0].native;
        setIcon(newIcon);
        // Trigger save immediately for icon change
        if (latestContentRef.current) {
            handleSave(latestContentRef.current, newIcon);
        }
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

    const handleGoBack = useCallback(async () => {
        // Clear any pending timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = undefined;
        }

        // Check if we need a final save
        if (latestContentRef.current && fileId) {
            const currentData = { content: latestContentRef.current, icon: latestIconRef.current };
            const currentDataStr = JSON.stringify(currentData);

            if (currentDataStr !== lastSavedContentRef.current) {
                setSaving(true);
                try {
                    await paperService.savePaper(fileId, currentData);
                    lastSavedContentRef.current = currentDataStr;
                    setIsUnsaved(false);
                } catch (e) {
                    console.error("Back navigation save failed", e);
                } finally {
                    setSaving(false);
                }
            }
        }

        router.push('/');
    }, [fileId, router]);




    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
                <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading your fantastic work...</p>
            </div>
        );
    }

    if (!fileId) {
        return <div className="p-8 text-center text-muted-foreground">Paper ID required</div>;
    }

    if (!content) return null;

    return (
        <>
            <AlertDialog open={!!pageAlert} onOpenChange={(open) => !open && setPageAlert(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Pro Feature</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pageAlert?.message || "This feature requires a Pro or Unlimited subscription. Upgrade to export your paper in various formats."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPageAlert(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => (window.location.href = '/pricing')}>
                            Upgrade Now
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <PaperEditorView
                initialValue={content}
                onChange={onChange}
                fileId={fileId}
                paperTitle={paperTitle}
                setPaperTitle={setPaperTitle}
                handleTitleSave={handleTitleSave}
                icon={icon}
                onSelectEmoji={onSelectEmoji}
                saving={saving}
                isUnsaved={isUnsaved}
                setHistoryOpen={setHistoryOpen}
                onBack={handleGoBack}
            />

            <VersionHistoryModal
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                fileId={fileId}
                onRestoreComplete={handleRestoreComplete}
            />
        </>
    );
}
