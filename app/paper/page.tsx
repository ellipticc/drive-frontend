"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconArrowLeft, IconCloudCheck, IconDotsVertical } from "@tabler/icons-react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PaperIdProvider } from "@/components/paper-id-context";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";

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
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const { emojiPickerState, isOpen, setIsOpen } = useEmojiDropdownMenuState();

    // Animated theme toggle functionality
    const toggleThemeWithAnimation = useCallback(() => {
        // Animation CSS for circle variant, top-right, no blur
        const animationCSS = `
          ::view-transition-group(root) {
            animation-duration: 1.5s;
            animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          }
                
          ::view-transition-new(root) {
            animation-name: reveal-light-top-right;
          }

          ::view-transition-old(root),
          .dark::view-transition-old(root) {
            animation: none;
            z-index: -1;
          }
          
          .dark::view-transition-new(root) {
            animation-name: reveal-dark-top-right;
          }

          @keyframes reveal-dark-top-right {
            from {
              clip-path: circle(0% at 100% 0%);
            }
            to {
              clip-path: circle(150.0% at 100% 0%);
            }
          }

          @keyframes reveal-light-top-right {
            from {
              clip-path: circle(0% at 100% 0%);
            }
            to {
              clip-path: circle(150.0% at 100% 0%);
            }
          }
        `;

        // Update styles
        const styleId = "theme-transition-styles";
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;

        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = animationCSS;

        // Switch theme
        const newTheme = theme === "light" ? "dark" : "light";
        
        const switchTheme = () => {
            setTheme(newTheme);
        };

        if (!document.startViewTransition) {
            switchTheme();
            return;
        }

        document.startViewTransition(switchTheme);
    }, [theme, setTheme]);

    // Determine display icon (emoji or first letter)
    const displayIcon = icon || (paperTitle ? paperTitle.charAt(0).toUpperCase() : "U");

    return (
        <header className="flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b px-3 md:px-6 shrink-0 bg-background z-50 md:rounded-tl-lg md:rounded-bl-lg">
            <div className="flex items-center gap-2 md:gap-3 w-full max-w-2xl">
                <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-muted shrink-0 h-9 w-9 md:h-10 md:w-10">
                    <IconArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>

                <EmojiPopover
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    control={
                        <Button
                            variant="ghost"
                            className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-transparent flex items-center justify-center shrink-0 hover:bg-muted p-0 text-base md:text-lg overflow-hidden"
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
                    className="text-lg md:text-xl font-semibold bg-transparent border-transparent hover:border-border focus:border-input focus:bg-background transition-colors w-full h-9 md:h-10 px-1 md:px-2 shadow-none truncate"
                    placeholder="Untitled Paper"
                />
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-4 shrink-0">
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground min-w-[60px] md:min-w-[80px] justify-end">
                    {saving ? (
                        <>
                            <IconLoader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                            <span className="hidden sm:inline">Saving...</span>
                        </>
                    ) : isUnsaved ? (
                        <span className="text-muted-foreground/70 hidden sm:inline">Unsaved</span>
                    ) : (
                        <>
                            <IconCloudCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                            <span className="text-green-500 font-medium hidden sm:inline">Saved</span>
                        </>
                    )}
                </div>
                
                {/* Mobile Menu Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild className="md:hidden">
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <IconDotsVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                            <IconHistory className="w-4 h-4 mr-2" />
                            Version History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={toggleThemeWithAnimation}>
                            {theme === 'dark' ? <IconSun className="w-4 h-4 mr-2" /> : <IconMoon className="w-4 h-4 mr-2" />}
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(true)} className="hidden md:flex h-9 w-9 md:h-10 md:w-10">
                            <IconHistory className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Version History</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1 rounded bg-muted/50 hidden lg:block cursor-help hover:bg-muted transition-colors">
                            Zero-Knowledge Encrypted
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <p>Your paper is encrypted with your private key before leaving your device. Only you can read it.</p>
                    </TooltipContent>
                </Tooltip>
                <div className="hidden md:block">
                    <ThemeToggle />
                </div>
                <div className="h-6 w-px bg-border mx-1 hidden md:block" />
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
        <PaperIdProvider paperId={fileId}>
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

                    <FixedToolbar className="border-b shrink-0 !relative !top-0 overflow-x-auto overflow-y-hidden scrollbar-hide touch-pan-x">
                        <FixedToolbarButtons />
                    </FixedToolbar>

                    <main className="flex-1 overflow-hidden relative">
                        <EditorContainer className="h-full w-full overflow-y-auto flex md:justify-center">
                            <div className="w-full md:max-w-[950px] px-4 sm:px-6 md:px-12 pb-32">
                                <Editor
                                    className="min-h-full w-full py-3 md:py-4 border-none shadow-none focus-visible:ring-0 transition-all text-base md:text-base"
                                    autoFocus
                                    placeholder="New Page"
                                />
                            </div>
                        </EditorContainer>
                    </main>
                </div>
            </Plate>
        </PaperIdProvider>
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

                // Pre-fetch assets to ensure they are available and satisfy user requirement
                paperService.getPaperAssets(fileId).catch(err => console.warn('[PaperPage] Failed to pre-fetch assets:', err));

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

                // Sanitize content: ensure all blocks have a children array
                const sanitizeBlock = (block: any): any => {
                    if (!block || typeof block !== 'object') {
                        return { type: 'p', children: [{ text: '' }] };
                    }

                    // Ensure children exists and is an array
                    if (!Array.isArray(block.children)) {
                        block.children = [{ text: '' }];
                    }

                    // Recursively sanitize children
                    block.children = block.children.map((child: any) => {
                        if (typeof child === 'object' && child !== null && 'children' in child) {
                            return sanitizeBlock(child);
                        }
                        // Leaf nodes (text nodes) should have a text property
                        if (typeof child === 'object' && child !== null && !('text' in child)) {
                            return { text: '' };
                        }
                        return child;
                    });

                    return block;
                };

                if (Array.isArray(loadedContent)) {
                    loadedContent = loadedContent.map(sanitizeBlock);
                } else {
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
