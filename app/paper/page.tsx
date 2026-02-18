"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconCloudCheck, IconHistory, IconEdit, IconFolderSymlink, IconTrash, IconCopy, IconFileText, IconPrinter, IconDownload, IconHelp, IconHome, IconStackFilled, IconLetterCase, IconChevronUp, IconChevronDown, IconLayoutSidebar, IconAbc, IconSparkles } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { type Value } from "platejs";
import { paperService } from "@/lib/paper-service";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Plate, usePlateEditor } from "platejs/react";
import { Editor } from "@/components/ui/editor";
import { EditorKit } from "@/components/editor-kit";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { FixedToolbarButtons } from "@/components/ui/fixed-toolbar-buttons";
import { VersionHistoryModal } from "@/components/modals/version-history-modal";
import { MoveToTrashModal } from "@/components/modals/move-to-trash-modal";
import { MoveToFolderModal } from "@/components/modals/move-to-folder-modal";
import { CopyModal } from "@/components/modals/copy-modal";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { PaperIdProvider, type WordCountStats } from "@/components/paper-id-context";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PaperScrollNavigation } from "@/components/ai-elements/paper-navigation";
import { PaperAIAssistant } from "@/components/paper/paper-ai-assistant";

// Print-specific styles to show only editor content
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            header, [role="toolbar"], nav, aside, footer, button, .sticky-word-count {
                display: none !important;
            }
            body {
                background: white !important;
                color: black !important;
            }
            [data-slate-editor] {
                padding: 20px !important;
                max-width: 100% !important;
            }
        }

        /* Block highlight effect */
        [data-highlighted-block="true"] {
            box-shadow: inset 0 0 0 2px var(--primary, #3b82f6);
            background-color: var(--primary, #3b82f6);
            background-color: rgba(59, 130, 246, 0.1);
            border-radius: 4px;
            transition: all 0.3s ease;
            animation: pulse-highlight 0.6s ease-in-out;
        }

        @keyframes pulse-highlight {
            0% {
                box-shadow: inset 0 0 0 2px var(--primary, #3b82f6), 0 0 0 0 rgba(59, 130, 246, 0.4);
            }
            50% {
                box-shadow: inset 0 0 0 2px var(--primary, #3b82f6), 0 0 0 8px rgba(59, 130, 246, 0.2);
            }
            100% {
                box-shadow: inset 0 0 0 2px var(--primary, #3b82f6), 0 0 0 0 rgba(59, 130, 246, 0);
            }
        }
    `;
    document.head.appendChild(style);
}

interface PaperHeaderProps {
    fileId: string;
    paperTitle: string;
    setPaperTitle: (title: string) => void;
    handleTitleSave: (title: string) => void;
    saving: boolean;
    isUnsaved: boolean;
    onHistoryOpen: (open: boolean, versionId?: string | null) => void;
    onBack: () => void;
    editorValue: Value | undefined;
    onCreateNewPaper: () => void;
    onMakeCopy: () => void;
    onMoveToFolder: () => void;
    onMoveToTrash: () => void;
    onPrint: () => void;
    onDownload: (format: string) => void;
    onCopyAsMarkdown: () => void;
    setSupportDialogOpen: (open: boolean) => void;
    showWordCount: boolean;
    setShowWordCount: (show: boolean) => void;
}

// Helper to count words from editor value
function countWords(value: Value | undefined): { words: number; characters: number; charactersNoSpaces: number; sentences: number } {
    if (!value || !Array.isArray(value)) return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0 };

    let text = '';
    const extractText = (nodes: any[]): void => {
        nodes.forEach(node => {
            if (node.text) {
                text += node.text;
            }
            if (node.children && Array.isArray(node.children)) {
                extractText(node.children);
            }
        });
    };

    extractText(value);

    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    return { words, characters, charactersNoSpaces, sentences };
}

function PaperHeader({
    fileId,
    paperTitle,
    setPaperTitle,
    handleTitleSave,
    saving,
    isUnsaved,
    onHistoryOpen,
    onBack,
    editorValue,
    onCreateNewPaper,
    onMakeCopy,
    onMoveToFolder,
    onMoveToTrash,
    onPrint,
    onDownload,
    onCopyAsMarkdown,
    setSupportDialogOpen,
    showWordCount,
    setShowWordCount
}: PaperHeaderProps) {
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const [isRenaming, setIsRenaming] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    // Track whether the title (main) dropdown is open so we can visually mute the title when active
    const [titleMenuOpen, setTitleMenuOpen] = useState(false);

    // Calculate word count stats
    const stats = useMemo(() => countWords(editorValue), [editorValue]);

    // Focus input when renaming mode starts
    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

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

    return (
        <header className="flex h-14 md:h-16 min-h-[3.5rem] md:min-h-[4rem] items-center gap-2 border-b px-4 shrink-0 bg-background z-50 transition-all duration-200 ease-in-out">
            <div className="flex items-center gap-2 flex-1 min-w-0">

                {/* Title Dropdown Menu */}
                {!isRenaming ? (
                    <DropdownMenu open={titleMenuOpen} onOpenChange={setTitleMenuOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <button className={`text-sm md:text-base font-semibold px-2 py-1 rounded-md transition-colors truncate text-left max-w-md ${titleMenuOpen ? 'bg-muted text-foreground' : 'hover:bg-muted'}`}>
                                        {paperTitle || "Untitled Paper"}
                                    </button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Paper options</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="start" className="w-64">
                            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                                <IconEdit className="w-4 h-4 mr-2" />
                                Rename document
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onCreateNewPaper}>
                                <IconStackFilled className="w-4 h-4 mr-2" />
                                New paper
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onMakeCopy}>
                                <IconCopy className="w-4 h-4 mr-2" />
                                Make a copy
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onMoveToFolder}>
                                <IconFolderSymlink className="w-4 h-4 mr-2" />
                                Move to folder
                            </DropdownMenuItem>

                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <IconAbc className="w-4 h-4 mr-2" />
                                    Word Count
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <div className="px-4 py-3 space-y-3 text-sm min-w-[180px]">
                                        <div className="space-y-2 text-muted-foreground">
                                            <div className="flex justify-between gap-6">
                                                <span className="font-medium">Words</span>
                                                <span className="font-semibold text-foreground text-base">{stats.words.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between gap-6">
                                                <span className="font-medium">Characters</span>
                                                <span className="font-semibold text-foreground text-base">{stats.characters.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between gap-6">
                                                <span className="font-medium">No Spaces</span>
                                                <span className="font-semibold text-foreground text-base">{stats.charactersNoSpaces.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <DropdownMenuSeparator className="-mx-1" />
                                        <div className="px-4 py-2 flex items-center justify-between">
                                            <Label htmlFor="word-count-toggle" className="text-sm font-medium cursor-pointer">
                                                Display Word Count
                                            </Label>
                                            <Switch
                                                id="word-count-toggle"
                                                checked={showWordCount}
                                                onCheckedChange={setShowWordCount}
                                            />
                                        </div>
                                    </div>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuItem onClick={() => onHistoryOpen(true)}>
                                <IconHistory className="w-4 h-4 mr-2" />
                                See version history
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={onMoveToTrash} className="text-destructive focus:bg-destructive/10 focus:text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground group/del">
                                <IconTrash className="mr-2 size-4 group-hover/del:text-destructive-foreground transition-colors" />
                                Move to trash
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={onPrint}>
                                <IconPrinter className="w-4 h-4 mr-2" />
                                Print
                                <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                            </DropdownMenuItem>

                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <IconDownload className="w-4 h-4 mr-2" />
                                    Download
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => onDownload('pdf')}>
                                        <IconFileText className="w-4 h-4 mr-2" />
                                        PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDownload('docx')}>
                                        <IconFileText className="w-4 h-4 mr-2" />
                                        DOCX
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDownload('markdown')}>
                                        <IconFileText className="w-4 h-4 mr-2" />
                                        Markdown
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDownload('image')}>
                                        <IconFileText className="w-4 h-4 mr-2" />
                                        Image
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDownload('html')}>
                                        <IconFileText className="w-4 h-4 mr-2" />
                                        HTML
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuItem onClick={onCopyAsMarkdown}>
                                <IconCopy className="w-4 h-4 mr-2" />
                                Copy as Markdown
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onSelect={() => setSupportDialogOpen(true)}>
                                <IconHelp className="w-4 h-4 mr-2" />
                                Help
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/')}>
                                <IconHome className="w-4 h-4 mr-2" />
                                Open Elliptic Drive
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Input
                        ref={inputRef}
                        value={paperTitle}
                        onChange={(e) => setPaperTitle(e.target.value)}
                        onBlur={() => {
                            setIsRenaming(false);
                            handleTitleSave(paperTitle);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsRenaming(false);
                                handleTitleSave(paperTitle);
                            } else if (e.key === 'Escape') {
                                setIsRenaming(false);
                            }
                        }}
                        maxLength={255}
                        className="text-sm md:text-base font-semibold h-8 max-w-md"
                        placeholder="Untitled Paper"
                    />
                )}
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-4 shrink-0">
                <div className="flex items-center gap-2">
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

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onHistoryOpen(true)} className="hidden md:flex h-9 w-9 md:h-10 md:w-10">
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
                </div>

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
    saving,
    isUnsaved,
    onHistoryOpen,
    onBack,
    onCreateNewPaper,
    onMakeCopy,
    onMoveToFolder,
    onMoveToTrash,
    onPrint,
    onDownload,
    onCopyAsMarkdown,
    setSupportDialogOpen,
    showWordCount,
    setShowWordCount,
    wordCountStats
}: {
    initialValue: Value;
    onChange: (value: Value) => void;
    fileId: string;
    paperTitle: string;
    setPaperTitle: (title: string) => void;
    handleTitleSave: (title: string) => void;
    saving: boolean;
    isUnsaved: boolean;
    onHistoryOpen: (open: boolean, versionId?: string | null) => void;
    onBack: () => void;
    onCreateNewPaper: () => void;
    onMakeCopy: () => void;
    onMoveToFolder: () => void;
    onMoveToTrash: () => void;
    onPrint: () => void;
    onDownload: (format: string) => void;
    onCopyAsMarkdown: () => void;
    setSupportDialogOpen: (open: boolean) => void;
    showWordCount: boolean;
    setShowWordCount: (show: boolean) => void;
    wordCountStats?: WordCountStats;
}) {
    const [editorValue, setEditorValue] = useState<Value>(initialValue);
    const [wordCountExpanded, setWordCountExpanded] = useState(false);
    const [displayMode, setDisplayMode] = useState<'words' | 'characters'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('wordCountDisplayMode');
            return (saved as 'words' | 'characters') || 'words';
        }
        return 'words';
    });
    const [blocks, setBlocks] = useState<any[]>([]);
    const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
    const wordCountRef = useRef<HTMLDivElement>(null);
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

    // Save display mode to localStorage
    useEffect(() => {
        localStorage.setItem('wordCountDisplayMode', displayMode);
    }, [displayMode]);

    // Close word count widget on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (wordCountRef.current && !wordCountRef.current.contains(target)) {
                setWordCountExpanded(false);
            }
        };

        if (wordCountExpanded) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [wordCountExpanded]);

    // Calculate stats for word count display
    const stats = useMemo(() => countWords(editorValue), [editorValue]);

    const editor = usePlateEditor({
        plugins: EditorKit,
        value: initialValue,
        override: {
            components: {},
        },
    });

    // Extract blocks from editor value for navigation
    const extractBlocks = useCallback((content: Value): any[] => {
        if (!Array.isArray(content)) return [];

        return (content as any[]).map((block, idx) => ({
            id: block.id || `block-${idx}`,
            type: block.type || 'paragraph',
            content:
                block.children?.[0]?.text ||
                block.children?.map((c: any) => c.text || '').join('') ||
                ''
        }));
    }, []);

    // Track editor changes for word count and block updates
    const handleChange = useCallback((value: Value) => {
        setEditorValue(value);
        const extractedBlocks = extractBlocks(value);
        setBlocks(extractedBlocks);
        onChange(value);
    }, [onChange, extractBlocks]);

    // Highlight block function
    const highlightBlock = useCallback((blockId: string) => {
        setHighlightedBlockId(blockId);
        const element = document.getElementById(`block-${blockId}`);
        if (element) {
            element.setAttribute('data-highlighted-block', 'true');
            // Ensure it's visible and scrolled to
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, []);

    // Clear highlight function
    const clearHighlight = useCallback(() => {
        if (highlightedBlockId) {
            const element = document.getElementById(`block-${highlightedBlockId}`);
            if (element) {
                element.setAttribute('data-highlighted-block', 'false');
            }
            setHighlightedBlockId(null);
        }
    }, [highlightedBlockId]);

    // Scroll to block function
    const scrollToBlock = useCallback((blockId: string, behavior: ScrollBehavior = 'smooth') => {
        const element = document.getElementById(`block-${blockId}`);
        if (element) {
            element.scrollIntoView({ behavior, block: 'start' });
        }
    }, []);

    // Add error boundary for editor operations
    React.useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            if (event.message.includes('Cannot read properties of undefined')) {
                console.warn('Editor content normalization warning:', event.message);
                event.preventDefault();
            }
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    // Monitor editor DOM and add IDs to blocks
    React.useEffect(() => {
        const observer = new MutationObserver(() => {
            const editorContainer = document.querySelector('[data-slate-editor]');
            if (!editorContainer) return;

            let blockIndex = 0;
            // Get all direct children that are block elements
            const blockElements = editorContainer.querySelectorAll(':scope > div');

            blockElements.forEach((blockEl, idx) => {
                const blockId = `block-${blocks[idx]?.id || idx}`;
                blockEl.setAttribute('id', blockId);
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        return () => observer.disconnect();
    }, [blocks]);

    // Handle URL hash on mount to navigate to initial block
    React.useEffect(() => {
        const hash = window.location.hash;
        const match = hash.match(/content=([^&]*)/);
        if (match?.[1]) {
            const blockId = match[1];
            // Give DOM time to render
            setTimeout(() => {
                highlightBlock(blockId);
            }, 100);
        }
    }, [highlightBlock]);

    return (
        <PaperIdProvider paperId={fileId} wordCountStats={wordCountStats}>
            <Plate
                editor={editor}
                onChange={({ value }) => handleChange(value)}
            >
                <div className="flex flex-col h-screen bg-background w-full overflow-hidden relative">
                    <PaperHeader
                        fileId={fileId}
                        paperTitle={paperTitle}
                        setPaperTitle={setPaperTitle}
                        handleTitleSave={handleTitleSave}
                        saving={saving}
                        isUnsaved={isUnsaved}
                        onHistoryOpen={onHistoryOpen}
                        onBack={onBack}
                        editorValue={editorValue}
                        onCreateNewPaper={onCreateNewPaper}
                        onMakeCopy={onMakeCopy}
                        onMoveToFolder={onMoveToFolder}
                        onMoveToTrash={onMoveToTrash}
                        onPrint={onPrint}
                        onDownload={onDownload}
                        onCopyAsMarkdown={onCopyAsMarkdown}
                        setSupportDialogOpen={setSupportDialogOpen}
                        showWordCount={showWordCount}
                        setShowWordCount={setShowWordCount}
                    />

                    <FixedToolbar className="border-b shrink-0 min-h-[44px] !relative !top-0 overflow-x-auto overflow-y-hidden scrollbar-hide touch-pan-x">
                        <FixedToolbarButtons />
                    </FixedToolbar>

                    <main className="flex-1 overflow-y-auto relative min-h-0" style={{ scrollbarGutter: 'stable' }}>
                        <div className="relative w-full md:max-w-[950px] mx-auto px-4 sm:px-6 md:px-12 pt-3 md:pt-4 pb-48">
                            <Editor
                                className="min-h-full w-full border-none shadow-none focus-visible:ring-0 transition-all text-base md:text-base"
                                autoFocus
                                placeholder="New Page"
                            />



                        </div>

                        {/* Paper Navigation (Right Side - mirrors chat) */}
                        <PaperScrollNavigation
                            blocks={blocks}
                            scrollToBlock={scrollToBlock}
                            highlightBlock={highlightBlock}
                            clearHighlight={clearHighlight}
                        />
                    </main>

                    {/* Floating Word Count (Bottom Left - Conditionally Visible) */}
                    {showWordCount && (
                        <div ref={wordCountRef} className="absolute bottom-4 left-4 z-40">
                            {/* Expanded panel — always renders above the pill */}
                            {wordCountExpanded && (
                                <div className="mb-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2 space-y-1 min-w-[140px]">
                                    <button
                                        onClick={() => {
                                            setDisplayMode('words');
                                            setWordCountExpanded(false);
                                        }}
                                        className={`flex items-center justify-between gap-4 px-2 py-1 text-xs w-full rounded transition-colors ${displayMode === 'words' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                                            }`}
                                    >
                                        <span className="font-medium">Words</span>
                                        <span className="font-medium">{stats.words.toLocaleString()}</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDisplayMode('characters');
                                            setWordCountExpanded(false);
                                        }}
                                        className={`flex items-center justify-between gap-4 px-2 py-1 text-xs w-full rounded transition-colors ${displayMode === 'characters' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                                            }`}
                                    >
                                        <span className="font-medium">Characters</span>
                                        <span className="font-medium">{stats.characters.toLocaleString()}</span>
                                    </button>
                                </div>
                            )}
                            {/* Pill — always at the bottom */}
                            <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                                <button
                                    onClick={() => setWordCountExpanded(!wordCountExpanded)}
                                    className={`flex items-center justify-between px-3 py-2 text-xs transition-colors w-full ${wordCountExpanded ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <span className="font-medium">{displayMode === 'words' ? 'Words' : 'Characters'}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-semibold">{displayMode === 'words' ? stats.words.toLocaleString() : stats.characters.toLocaleString()}</span>
                                        {wordCountExpanded ? (
                                            <IconChevronDown className="w-3 h-3" />
                                        ) : (
                                            <IconChevronUp className="w-3 h-3" />
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* AI Assistant */}
                <PaperAIAssistant
                    isOpen={isAIAssistantOpen}
                    onClose={() => setIsAIAssistantOpen(false)}
                    paperTitle={paperTitle}
                />

                {/* AI Floating Trigger Button */}
                {!isAIAssistantOpen && (
                    <button
                        onClick={() => setIsAIAssistantOpen(true)}
                        className="fixed bottom-6 right-6 z-50 p-3 bg-white text-black rounded-full shadow-xl hover:scale-105 transition-transform duration-200 border border-gray-200 group"
                        aria-label="Open AI Assistant"
                    >
                        <div className="relative">
                            <IconSparkles className="w-6 h-6 stroke-1.5" />
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                        </div>
                    </button>
                )}
            </Plate>
        </PaperIdProvider>
    );
}

function PaperPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const fileId = searchParams.get('fileId');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isUnsaved, setIsUnsaved] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [content, setContent] = useState<Value | undefined>(undefined);
    const [paperTitle, setPaperTitle] = useState<string>("Untitled Paper");
    const [showWordCount, setShowWordCount] = useState(false);

    // Modal states
    const [trashModalOpen, setTrashModalOpen] = useState(false);
    const [moveToFolderModalOpen, setMoveToFolderModalOpen] = useState(false);
    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [supportDialogOpen, setSupportDialogOpen] = useState(false);

    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const savingRef = useRef<boolean>(false);

    const lastSavedTitleRef = useRef<string>("Untitled Paper");

    // Calculate word count stats to pass to context
    const wordCountStats = useMemo<WordCountStats>(() => {
        const stats = countWords(content);
        return { words: stats.words, characters: stats.characters, sentences: stats.sentences };
    }, [content]);



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
                const currentDataStr = JSON.stringify(latestContentRef.current);

                if (currentDataStr !== lastSavedContentRef.current) {
                    // If we have local changes, save them immediately before snapshotting
                    paperService.savePaper(fileId, latestContentRef.current)
                        .then(() => paperService.snapshot(fileId, 'close', latestContentRef.current))
                        .catch(e => {
                            console.error("Final unmount save failed", e);
                            // Still try to snapshot what we have
                            paperService.snapshot(fileId, 'close', latestContentRef.current);
                        });
                } else {
                    // No new changes, just snapshot
                    paperService.snapshot(fileId, 'close', latestContentRef.current).catch(e => console.error("Close snapshot failed", e));
                }
            } else {
                paperService.snapshot(fileId, 'close', undefined).catch(e => console.error("Close snapshot failed", e));
            }
        };
    }, [fileId]);

    // Prevent page-level scrolling while editor is mounted so only the main container scrolls
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;

        // Hide scroll on html/body while paper editor is active
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        return () => {
            // Restore previous overflow values
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
        };
    }, []);

    // URL State Management for Version History - using hash-based format
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleHashChange = () => {
            const hash = window.location.hash;

            // Parse hash for #versions or #versions?versionId=xxx
            if (hash.startsWith('#versions')) {
                setHistoryOpen(true);

                // Extract versionId from hash if present
                const versionIdMatch = hash.match(/versionId=([^&]*)/);
                if (versionIdMatch?.[1]) {
                    setSelectedVersionId(versionIdMatch[1]);
                } else {
                    setSelectedVersionId(null);
                }
            } else {
                setHistoryOpen(false);
                setSelectedVersionId(null);
            }
        };

        // Check initial hash
        handleHashChange();

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Update URL when history modal state changes - using hash-based state
    const updateHistoryUrl = useCallback((open: boolean, versionId?: string | null) => {
        if (typeof window === 'undefined') return;

        if (open) {
            let hash = '#versions';
            if (versionId) {
                hash += `?versionId=${versionId}`;
            }
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
        } else {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        }
    }, []);

    // Wrapper for setHistoryOpen that also updates URL
    const handleHistoryOpen = useCallback((open: boolean, versionId?: string | null) => {
        setHistoryOpen(open);
        if (versionId) {
            setSelectedVersionId(versionId);
        }
        updateHistoryUrl(open, versionId);
    }, [updateHistoryUrl]);

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
                document.title = `${paper.title} | Ellipticc`;

                let loadedContent: Value;
                const rawContent = paper.content;

                // Handle array content (no longer wrapped with icon)
                if (Array.isArray(rawContent) && rawContent.length > 0) {
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

    // Force reload when restore happens
    const handleRestoreComplete = () => {
        window.location.reload();
    };

    // Save Logic (Content)
    const handleSave = useCallback(async (newValue: Value, newIcon?: string) => {
        if (!fileId) return;
        const contentString = JSON.stringify(newValue);

        // Prevent unnecessary saves if strictly identical to last save AND we know we are cleaner
        if (contentString === lastSavedContentRef.current) {
            setIsUnsaved(false); // Ensure status is correct
            return;
        }

        const saveStartTime = Date.now();
        setSaving(true);
        savingRef.current = true;
        try {
            if (!masterKeyManager.hasMasterKey()) return;
            // Save content directly (no icon wrapping)
            await paperService.savePaper(fileId, newValue);

            // Only mark as clean if no new changes occurred during save
            if (lastChangeTimeRef.current <= saveStartTime) {
                setIsUnsaved(false);
                lastSavedContentRef.current = contentString;
            }

            // Check if there are newer changes that need saving
            const latestContent = latestContentRef.current;
            if (latestContent) {
                const latestString = JSON.stringify(latestContent);
                if (latestString !== lastSavedContentRef.current) {
                    // There are newer changes, save them immediately
                    setTimeout(() => handleSave(latestContent), 0);
                    return;
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to save content");
        } finally {
            setSaving(false);
            savingRef.current = false;
        }
    }, [fileId]);

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
            document.title = `${newTitle} | Ellipticc`;
        } catch (e) {
            console.error(e);
            toast.error("Failed to save title");
        }
    };

    // Auto-save debounce
    const onChange = (newValue: Value) => {
        // Compare stringified content to detect actual changes (not just selection/focus)
        const newContentString = JSON.stringify(newValue);

        // Only proceed if content actually changed
        if (newContentString === lastSavedContentRef.current) {
            return; // No actual content change, just selection/focus
        }

        latestContentRef.current = newValue;
        lastChangeTimeRef.current = Date.now();
        setIsUnsaved(true);

        // If a save is already in progress, don't start another timeout
        // The current save will check for newer changes when it completes
        if (savingRef.current) {
            return;
        }

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            // Don't save if already saving
            if (savingRef.current) return;
            handleSave(newValue);
        }, 800);
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
            const currentDataStr = JSON.stringify(latestContentRef.current);

            if (currentDataStr !== lastSavedContentRef.current) {
                setSaving(true);
                try {
                    await paperService.savePaper(fileId, latestContentRef.current);
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

    // Action Handlers
    const handleCreateNewPaper = useCallback(async () => {
        try {
            const now = new Date();
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}.${String(now.getSeconds()).padStart(2, '0')}`;

            // Open new tab immediately with loading state
            const newTab = window.open('about:blank', '_blank');

            const newPaperId = await paperService.createPaper(`Untitled paper ${timestamp}`, undefined, null);
            if (newPaperId && newTab) {
                newTab.location.href = `/paper?fileId=${newPaperId}`;
            } else if (newTab) {
                newTab.close();
                toast.error('Failed to create new paper');
            }
        } catch (error) {
            console.error('Failed to create new paper:', error);
            toast.error('Failed to create new paper');
        }
    }, []);

    const handleMakeCopy = useCallback(() => {
        if (!fileId) return;
        setCopyModalOpen(true);
    }, [fileId]);

    const handleMoveToFolder = useCallback(() => {
        if (!fileId) return;
        setMoveToFolderModalOpen(true);
    }, [fileId]);

    const handleMoveToTrash = useCallback(() => {
        if (!fileId) return;
        setTrashModalOpen(true);
    }, [fileId]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const handleDownload = useCallback(async (format: string) => {
        if (!latestContentRef.current) {
            toast.error('No content to export');
            return;
        }

        try {
            const title = paperTitle || 'Document';
            const getExportFilename = (extension: string) => {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const sanitized = title.replace(/[^a-z0-9\s-_]/gi, '').trim();
                return `${sanitized || 'document'}-${timestamp}.${extension}`;
            };

            const downloadFile = (url: string, filename: string) => {
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            };

            switch (format) {
                case 'image': {
                    toast.info('Opening print dialog for image export. Use "Save as PDF" or print to image.');
                    window.print();
                    break;
                }

                case 'markdown': {
                    const convertToMarkdown = (nodes: any[]): string => {
                        let result = '';

                        nodes.forEach((node: any) => {
                            const processNode = (n: any): string => {
                                if (typeof n === 'string') return n;
                                if (n.text) return n.text;
                                if (Array.isArray(n.children)) {
                                    return n.children.map(processNode).join('');
                                }
                                return '';
                            };

                            let childContent = '';
                            if (node.children && Array.isArray(node.children)) {
                                childContent = node.children.map(processNode).join('');
                            }

                            switch (node.type) {
                                case 'h1':
                                    result += `# ${childContent}\n\n`;
                                    break;
                                case 'h2':
                                    result += `## ${childContent}\n\n`;
                                    break;
                                case 'h3':
                                    result += `### ${childContent}\n\n`;
                                    break;
                                case 'h4':
                                    result += `#### ${childContent}\n\n`;
                                    break;
                                case 'h5':
                                    result += `##### ${childContent}\n\n`;
                                    break;
                                case 'h6':
                                    result += `###### ${childContent}\n\n`;
                                    break;
                                case 'blockquote':
                                    result += `> ${childContent}\n\n`;
                                    break;
                                case 'code_block':
                                    result += `\`\`\`\n${childContent}\n\`\`\`\n\n`;
                                    break;
                                case 'ul':
                                case 'ol':
                                    result += childContent;
                                    break;
                                case 'li':
                                    result += `- ${childContent}\n`;
                                    break;
                                case 'p':
                                default:
                                    result += `${childContent}\n\n`;
                                    break;
                            }
                        });

                        return result;
                    };

                    const markdown = convertToMarkdown(latestContentRef.current as any[]);
                    const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
                    downloadFile(url, getExportFilename('md'));
                    toast.success('Markdown exported successfully');
                    break;
                }

                case 'html': {
                    const convertToHtml = (nodes: any[]): string => {
                        let result = '';

                        const processNode = (n: any): string => {
                            if (typeof n === 'string') return n;
                            if (n.text) return n.text;
                            if (Array.isArray(n.children)) {
                                return n.children.map(processNode).join('');
                            }
                            return '';
                        };

                        nodes.forEach((node: any) => {
                            let childContent = '';
                            if (node.children && Array.isArray(node.children)) {
                                childContent = node.children.map(processNode).join('');
                            }

                            switch (node.type) {
                                case 'h1':
                                    result += `<h1>${childContent}</h1>`;
                                    break;
                                case 'h2':
                                    result += `<h2>${childContent}</h2>`;
                                    break;
                                case 'h3':
                                    result += `<h3>${childContent}</h3>`;
                                    break;
                                case 'h4':
                                    result += `<h4>${childContent}</h4>`;
                                    break;
                                case 'h5':
                                    result += `<h5>${childContent}</h5>`;
                                    break;
                                case 'h6':
                                    result += `<h6>${childContent}</h6>`;
                                    break;
                                case 'blockquote':
                                    result += `<blockquote>${childContent}</blockquote>`;
                                    break;
                                case 'code_block':
                                    result += `<pre><code>${childContent}</code></pre>`;
                                    break;
                                case 'ul':
                                    result += `<ul>${childContent}</ul>`;
                                    break;
                                case 'ol':
                                    result += `<ol>${childContent}</ol>`;
                                    break;
                                case 'li':
                                    result += `<li>${childContent}</li>`;
                                    break;
                                case 'p':
                                default:
                                    result += `<p>${childContent}</p>`;
                                    break;
                            }
                        });

                        return result;
                    };

                    const html = convertToHtml(latestContentRef.current as any[]);
                    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
      }
      h1, h2, h3, h4, h5, h6 { margin-top: 1em; margin-bottom: 0.5em; }
      p { margin-bottom: 1em; }
      blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin-left: 0; color: #666; }
      code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
      pre { background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
      pre code { background: none; padding: 0; }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`;
                    const url = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
                    downloadFile(url, getExportFilename('html'));
                    toast.success('HTML exported successfully');
                    break;
                }

                case 'pdf': {
                    toast.info('PDF export: Opening print dialog. Use "Save as PDF" in the print dialog.');
                    window.print();
                    break;
                }

                case 'docx': {
                    const convertToHtml = (nodes: any[]): string => {
                        let result = '';

                        const processNode = (n: any): string => {
                            if (typeof n === 'string') return n;
                            if (n.text) return n.text;
                            if (Array.isArray(n.children)) {
                                return n.children.map(processNode).join('');
                            }
                            return '';
                        };

                        nodes.forEach((node: any) => {
                            let childContent = '';
                            if (node.children && Array.isArray(node.children)) {
                                childContent = node.children.map(processNode).join('');
                            }

                            switch (node.type) {
                                case 'h1':
                                    result += `<h1>${childContent}</h1>`;
                                    break;
                                case 'h2':
                                    result += `<h2>${childContent}</h2>`;
                                    break;
                                case 'h3':
                                    result += `<h3>${childContent}</h3>`;
                                    break;
                                case 'h4':
                                    result += `<h4>${childContent}</h4>`;
                                    break;
                                case 'h5':
                                    result += `<h5>${childContent}</h5>`;
                                    break;
                                case 'h6':
                                    result += `<h6>${childContent}</h6>`;
                                    break;
                                case 'blockquote':
                                    result += `<blockquote>${childContent}</blockquote>`;
                                    break;
                                case 'code_block':
                                    result += `<pre><code>${childContent}</code></pre>`;
                                    break;
                                case 'ul':
                                    result += `<ul>${childContent}</ul>`;
                                    break;
                                case 'ol':
                                    result += `<ol>${childContent}</ol>`;
                                    break;
                                case 'li':
                                    result += `<li>${childContent}</li>`;
                                    break;
                                case 'p':
                                default:
                                    result += `<p>${childContent}</p>`;
                                    break;
                            }
                        });

                        return result;
                    };

                    try {
                        // @ts-ignore - no type definitions available
                        const { default: htmlDocx } = await import('html-docx-js/dist/html-docx');

                        const html = convertToHtml(latestContentRef.current as any[]);
                        const htmlContent = `
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: 'Calibri', 'Arial', sans-serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #000000;
      }
      h1 { font-size: 26pt; }
      h2 { font-size: 19pt; }
      h3 { font-size: 14pt; }
      p { margin-bottom: 1em; }
      blockquote { border-left: 4px solid #ddd; padding-left: 1em; color: #666; }
      code { background: #f4f4f4; padding: 2px 4px; }
      pre { background: #f4f4f4; padding: 1em; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`;

                        const docxBlob = htmlDocx.asBlob(htmlContent);
                        const url = URL.createObjectURL(docxBlob);
                        downloadFile(url, getExportFilename('docx'));
                        toast.success('DOCX exported successfully');
                    } catch (error) {
                        console.error('DOCX export error:', error);
                        toast.error('Failed to export as DOCX');
                    }
                    break;
                }

                default:
                    toast.error('Unknown export format');
            }
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export document');
        }
    }, [paperTitle]);

    const handleCopyAsMarkdown = useCallback(() => {
        if (!latestContentRef.current) {
            toast.error('No content to copy');
            return;
        }

        try {
            // Convert editor content to markdown
            let markdown = '';

            const convertToMarkdown = (nodes: any[]): string => {
                let result = '';

                nodes.forEach(node => {
                    if (node.text !== undefined) {
                        // Text node
                        let text = node.text;
                        if (node.bold) text = `**${text}**`;
                        if (node.italic) text = `*${text}*`;
                        if (node.underline) text = `__${text}__`;
                        if (node.strikethrough) text = `~~${text}~~`;
                        if (node.code) text = `\`${text}\``;
                        result += text;
                    } else if (node.children && Array.isArray(node.children)) {
                        // Block node
                        const childContent = convertToMarkdown(node.children);

                        switch (node.type) {
                            case 'h1':
                                result += `# ${childContent}\n\n`;
                                break;
                            case 'h2':
                                result += `## ${childContent}\n\n`;
                                break;
                            case 'h3':
                                result += `### ${childContent}\n\n`;
                                break;
                            case 'h4':
                                result += `#### ${childContent}\n\n`;
                                break;
                            case 'h5':
                                result += `##### ${childContent}\n\n`;
                                break;
                            case 'h6':
                                result += `###### ${childContent}\n\n`;
                                break;
                            case 'blockquote':
                                result += `> ${childContent}\n\n`;
                                break;
                            case 'code_block':
                                result += `\`\`\`\n${childContent}\n\`\`\`\n\n`;
                                break;
                            case 'ul':
                                result += childContent;
                                break;
                            case 'ol':
                                result += childContent;
                                break;
                            case 'li':
                                result += `- ${childContent}\n`;
                                break;
                            case 'p':
                            default:
                                result += `${childContent}\n\n`;
                                break;
                        }
                    }
                });

                return result;
            };

            markdown = convertToMarkdown(latestContentRef.current as any[]);

            // Copy to clipboard
            navigator.clipboard.writeText(markdown).then(() => {
                toast.success('Copied as Markdown to clipboard');
            }).catch(() => {
                toast.error('Failed to copy to clipboard');
            });
        } catch (error) {
            console.error('Failed to convert to markdown:', error);
            toast.error('Failed to copy as Markdown');
        }
    }, []);

    const handleItemMoved = useCallback(() => {
        // After moving to trash, go back to home
        router.push('/');
        toast.success('Paper moved to trash');
    }, [router]);

    const handleFolderMoved = useCallback(() => {
        // Refresh or update UI after moving to folder
        toast.success('Paper moved to folder');
    }, []);

    const handleItemCopied = useCallback(() => {
        // CopyModal already shows "1 item copied successfully", no need for duplicate
    }, []);


    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col bg-background">
                {/* Header Skeleton */}
                <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-32 rounded" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-20 rounded" />
                            <Skeleton className="h-8 w-20 rounded" />
                        </div>
                    </div>
                </div>

                {/* Toolbar Skeleton */}
                <div className="border-b bg-background/50 h-12 flex items-center px-4 gap-2">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                </div>

                {/* Main Content Area Skeleton */}
                <div className="flex-1 overflow-y-auto relative">
                    <div className="w-full md:max-w-[950px] mx-auto px-4 sm:px-6 md:px-12 pt-6 pb-48 space-y-4">
                        <Skeleton className="h-8 w-96 rounded" />
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-4/5 rounded" />
                        <div className="pt-6 space-y-4">
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-3/4 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!fileId) {
        return <div className="p-8 text-center text-muted-foreground">Paper ID required</div>;
    }

    if (!content) return null;

    return (
        <>
            <PaperEditorView
                initialValue={content}
                onChange={onChange}
                fileId={fileId}
                paperTitle={paperTitle}
                setPaperTitle={setPaperTitle}
                handleTitleSave={handleTitleSave}
                saving={saving}
                isUnsaved={isUnsaved}
                onHistoryOpen={handleHistoryOpen}
                onBack={handleGoBack}
                onCreateNewPaper={handleCreateNewPaper}
                onMakeCopy={handleMakeCopy}
                onMoveToFolder={handleMoveToFolder}
                onMoveToTrash={handleMoveToTrash}
                onPrint={handlePrint}
                onDownload={handleDownload}
                onCopyAsMarkdown={handleCopyAsMarkdown}
                setSupportDialogOpen={setSupportDialogOpen}
                showWordCount={showWordCount}
                setShowWordCount={setShowWordCount}
                wordCountStats={wordCountStats}
            />

            <VersionHistoryModal
                isOpen={historyOpen}
                onClose={() => handleHistoryOpen(false)}
                fileId={fileId}
                onRestoreComplete={handleRestoreComplete}
                selectedVersionId={selectedVersionId}
                onVersionSelect={(versionId) => handleHistoryOpen(true, versionId)}
            />

            <MoveToTrashModal
                open={trashModalOpen}
                onOpenChange={setTrashModalOpen}
                itemId={fileId || ''}
                itemName={paperTitle}
                itemType="file"
                onItemMoved={handleItemMoved}
            />

            <MoveToFolderModal
                open={moveToFolderModalOpen}
                onOpenChange={setMoveToFolderModalOpen}
                itemId={fileId || ''}
                itemName={paperTitle}
                itemType="file"
                onItemMoved={handleFolderMoved}
            />

            <CopyModal
                open={copyModalOpen}
                onOpenChange={setCopyModalOpen}
                itemId={fileId || ''}
                itemName={paperTitle}
                itemType="file"
                onItemCopied={handleItemCopied}
            />

            <SupportRequestDialog
                open={supportDialogOpen}
                onOpenChange={setSupportDialogOpen}
            />

        </>
    );
}

export default function PaperPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-svh" />}>
            <PaperPageContent />
        </Suspense>
    );
}
