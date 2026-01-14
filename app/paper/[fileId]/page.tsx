"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconArrowLeft, IconCloudCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type Value } from "platejs";
import { paperService } from "@/lib/paper-service";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HeaderUser } from "@/components/header-user";
import { Input } from "@/components/ui/input";
import { Plate, usePlateEditor, PlateController } from "platejs/react";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { EditorKit } from "@/components/editor-kit";
import { useEmojiDropdownMenuState } from "@platejs/emoji/react";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { FixedToolbarButtons } from "@/components/ui/fixed-toolbar-buttons";
import { EmojiPopover, EmojiPicker } from "@/components/ui/emoji-toolbar-button";

interface PaperHeaderProps {
    fileId: string;
    paperTitle: string;
    setPaperTitle: (title: string) => void;
    handleTitleSave: (title: string) => void;
    icon: string | null;
    onSelectEmoji: (emoji: any) => void;
    saving: boolean;
    isUnsaved: boolean;
}

function PaperHeader({
    fileId,
    paperTitle,
    setPaperTitle,
    handleTitleSave,
    icon,
    onSelectEmoji,
    saving,
    isUnsaved
}: PaperHeaderProps) {
    const router = useRouter();
    const { emojiPickerState, isOpen, setIsOpen } = useEmojiDropdownMenuState();

    // Determine display icon (emoji or first letter)
    const displayIcon = icon || (paperTitle ? paperTitle.charAt(0).toUpperCase() : "U");

    return (
        <header className="flex h-16 items-center gap-4 border-b px-6 shrink-0 bg-background z-50">
            <div className="flex items-center gap-3 w-full max-w-2xl">
                <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="hover:bg-muted shrink-0">
                    <IconArrowLeft className="w-5 h-5" />
                </Button>

                <EmojiPopover
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    control={
                        <Button
                            variant="ghost"
                            className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 p-0 text-xl overflow-hidden"
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
    isUnsaved
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
                />

                <FixedToolbar className="border-b shrink-0 !relative !top-0">
                    <FixedToolbarButtons />
                </FixedToolbar>

                <main className="flex-1 overflow-hidden relative">
                    <EditorContainer className="h-full w-full overflow-y-auto">
                        <Editor className="min-h-full w-full max-w-4xl mx-auto px-4 md:px-6 py-4 border-none shadow-none focus-visible:ring-0" />
                    </EditorContainer>
                </main>
            </div>
        </Plate>
    );
}

export default function PaperPage() {
    const params = useParams();
    const router = useRouter();
    const fileId = params.fileId as string;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isUnsaved, setIsUnsaved] = useState(false);
    const [content, setContent] = useState<Value | undefined>(undefined);
    const [paperTitle, setPaperTitle] = useState<string>("Untitled Paper");
    const [icon, setIcon] = useState<string | null>(null);
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

    // Save Logic (Content + Icon)
    const handleSave = useCallback(async (newValue: Value, newIcon?: string) => {
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
        if (newTitle.trim() === paperTitle || newTitle.trim() === '') {
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




    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <IconLoader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!content) return null;

    return (
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
        />
    );
}

