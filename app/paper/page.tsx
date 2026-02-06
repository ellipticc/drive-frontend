"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { masterKeyManager } from "@/lib/master-key";
import { IconLoader2, IconCloudCheck, IconHistory, IconEdit, IconFolderSymlink, IconTrash, IconCopy, IconFileText, IconPrinter, IconDownload, IconHelp, IconHome, IconStackFilled, IconLetterCase, IconChevronUp, IconChevronDown, IconLayoutSidebar } from "@tabler/icons-react";
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
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { type Value } from "platejs";
import { paperService } from "@/lib/paper-service";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Plate, usePlateEditor } from "platejs/react";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { EditorKit } from "@/components/editor-kit";
import { useEmojiDropdownMenuState } from "@platejs/emoji/react";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { FixedToolbarButtons } from "@/components/ui/fixed-toolbar-buttons";
import { EmojiPopover, EmojiPicker } from "@/components/ui/emoji-toolbar-button";
import { VersionHistoryModal } from "@/components/modals/version-history-modal";
import { MoveToTrashModal } from "@/components/modals/move-to-trash-modal";
import { MoveToFolderModal } from "@/components/modals/move-to-folder-modal";
import { CopyModal } from "@/components/modals/copy-modal";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { PaperIdProvider } from "@/components/paper-id-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
    `;
    document.head.appendChild(style);
}

interface PaperHeaderProps {
    fileId: string;
    paperTitle: string;
    setPaperTitle: (title: string) => void;
    handleTitleSave: (title: string) => void;
    icon: string | null;
    onSelectEmoji: (emoji: any) => void;
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
function countWords(value: Value | undefined): { words: number; characters: number; charactersNoSpaces: number } {
    if (!value || !Array.isArray(value)) return { words: 0, characters: 0, charactersNoSpaces: 0 };

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

    return { words, characters, charactersNoSpaces };
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
    const { emojiPickerState, isOpen, setIsOpen } = useEmojiDropdownMenuState();
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

    // Determine display icon (emoji or first letter)
    const displayIcon = icon || (paperTitle ? paperTitle.charAt(0).toUpperCase() : "U");

    return (
        <header className="flex h-14 md:h-16 min-h-[3.5rem] md:min-h-[4rem] items-center gap-2 md:gap-4 border-b px-3 md:px-6 shrink-0 bg-background z-50">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <SidebarTrigger className="h-9 w-9 md:h-10 md:w-10" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <span className="text-xs">Toggle sidebar · <kbd className="rounded bg-muted/40 px-1">Ctrl</kbd>/<kbd className="rounded bg-muted/40 px-1">Cmd</kbd> + <kbd className="rounded bg-muted/40 px-1">B</kbd></span>
                    </TooltipContent>
                </Tooltip>

                <div className="h-6 w-px bg-border mx-1 hidden md:block" />

                <EmojiPopover
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    control={
                        <Button
                            variant="ghost"
                            className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-transparent flex items-center justify-center shrink-0 hover:bg-muted p-0 text-sm md:text-base overflow-hidden"
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

                {/* Title Dropdown Menu */}
                {!isRenaming ? (
                    <DropdownMenu open={titleMenuOpen} onOpenChange={setTitleMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button className={`text-sm md:text-base font-semibold px-2 py-1 rounded-md transition-colors truncate text-left max-w-md ${titleMenuOpen ? 'bg-muted text-foreground' : 'hover:bg-muted'}`}>
                                {paperTitle || "Untitled Paper"}
                            </button>
                        </DropdownMenuTrigger>
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
                            <DropdownMenuItem onClick={() => onHistoryOpen(true)}>
                                <IconHistory className="w-4 h-4 mr-2" />
                                See version history
                            </DropdownMenuItem>

                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <IconLetterCase className="w-4 h-4 mr-2" />
                                    Word count
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <div className="px-2 py-3 space-y-2 w-52">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Words</span>
                                            <span className="font-medium">{stats.words.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Characters</span>
                                            <span className="font-medium">{stats.characters.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Characters (no spaces)</span>
                                            <span className="font-medium">{stats.charactersNoSpaces.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <div className="px-2 py-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="word-count-menu-toggle" className="text-sm cursor-pointer">Show word count</Label>
                                            <Switch
                                                id="word-count-menu-toggle"
                                                checked={showWordCount}
                                                onCheckedChange={setShowWordCount}
                                            />
                                        </div>
                                    </div>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={onMoveToTrash} className="text-destructive focus:text-destructive">
                                <IconTrash className="w-4 h-4 mr-2" />
                                Move to trash
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={onPrint}>
                                <IconPrinter className="w-4 h-4 mr-2" />
                                Print
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

                <Separator orientation="vertical" className="mx-1 h-4 hidden md:block" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <ThemeToggle aria-label="Toggle theme" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <span className="text-xs">Toggle theme</span>
                    </TooltipContent>
                </Tooltip>
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
    setShowWordCount
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

    // Save display mode to localStorage
    useEffect(() => {
        localStorage.setItem('wordCountDisplayMode', displayMode);
    }, [displayMode]);

    const editor = usePlateEditor({
        plugins: EditorKit,
        value: initialValue,
        override: {
            components: {},
        },
    });

    // Track editor changes for word count
    const handleChange = useCallback((value: Value) => {
        setEditorValue(value);
        onChange(value);
    }, [onChange]);

    const stats = useMemo(() => countWords(editorValue), [editorValue]);

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

    return (
        <PaperIdProvider paperId={fileId}>
            <Plate
                editor={editor}
                onChange={({ value }) => handleChange(value)}
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
                        <div className="w-full md:max-w-[950px] mx-auto px-4 sm:px-6 md:px-12 pt-3 md:pt-4 pb-48">
                            <Editor
                                className="min-h-full w-full border-none shadow-none focus-visible:ring-0 transition-all text-base md:text-base"
                                autoFocus
                                placeholder="New Page"
                            />
                        </div>

                        {/* Floating Word Count (Bottom Left - Conditionally Visible) */}
                        {showWordCount && (
                            <div className="fixed bottom-4 left-4 z-40">
                                <div className={`bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden ${wordCountExpanded ? 'flex flex-col-reverse' : ''}`}>
                                    {/* Dropdown Menu - Opens Above */}
                                    {wordCountExpanded && (
                                        <div className="border-b px-3 py-2 space-y-1">
                                            <button
                                                onClick={() => setDisplayMode('words')}
                                                className={`flex items-center gap-2 px-2 py-1 text-xs w-full rounded transition-colors ${displayMode === 'words' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                                                    }`}
                                            >
                                                <span className="font-medium">Words</span>
                                                <span className="font-medium">{stats.words.toLocaleString()}</span>
                                            </button>
                                            <button
                                                onClick={() => setDisplayMode('characters')}
                                                className={`flex items-center gap-2 px-2 py-1 text-xs w-full rounded transition-colors ${displayMode === 'characters' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                                                    }`}
                                            >
                                                <span className="font-medium">Characters</span>
                                                <span className="font-medium">{stats.characters.toLocaleString()}</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Main Button */}
                                    <button
                                        onClick={() => setWordCountExpanded(!wordCountExpanded)}
                                        className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${wordCountExpanded ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="font-medium">{displayMode === 'words' ? 'Words' : 'Characters'}</span>
                                            <span className="font-semibold">{displayMode === 'words' ? stats.words.toLocaleString() : stats.characters.toLocaleString()}</span>
                                        </div>
                                        {wordCountExpanded ? (
                                            <IconChevronUp className="w-3 h-3 shrink-0 ml-2" />
                                        ) : (
                                            <IconChevronDown className="w-3 h-3 shrink-0 ml-2" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
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
    const [icon, setIcon] = useState<string | null>(null);
    const [pageAlert, setPageAlert] = useState<{ message: string } | null>(null);
    const [showWordCount, setShowWordCount] = useState(false);

    // Modal states
    const [trashModalOpen, setTrashModalOpen] = useState(false);
    const [moveToFolderModalOpen, setMoveToFolderModalOpen] = useState(false);
    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [supportDialogOpen, setSupportDialogOpen] = useState(false);

    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const savingRef = useRef<boolean>(false);
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
                        .then(() => paperService.snapshot(fileId, 'close', currentData))
                        .catch(e => {
                            console.error("Final unmount save failed", e);
                            // Still try to snapshot what we have
                            paperService.snapshot(fileId, 'close', currentData);
                        });
                } else {
                    // No new changes, just snapshot
                    paperService.snapshot(fileId, 'close', currentData).catch(e => console.error("Close snapshot failed", e));
                }
            } else {
                paperService.snapshot(fileId, 'close', latestContentRef.current ? { content: latestContentRef.current, icon: latestIconRef.current } : undefined).catch(e => console.error("Close snapshot failed", e));
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
        savingRef.current = true;
        try {
            if (!masterKeyManager.hasMasterKey()) return;
            // We save the wrapped object
            await paperService.savePaper(fileId, dataToSave);

            // Only mark as clean if no new changes occurred during save
            if (lastChangeTimeRef.current <= saveStartTime) {
                setIsUnsaved(false);
                lastSavedContentRef.current = contentString;
            }

            // Check if there are newer changes that need saving
            const latestContent = latestContentRef.current;
            const latestIcon = latestIconRef.current;
            if (latestContent) {
                const latestData = { content: latestContent, icon: latestIcon };
                const latestString = JSON.stringify(latestData);
                if (latestString !== lastSavedContentRef.current) {
                    // There are newer changes, save them immediately
                    setTimeout(() => handleSave(latestContent, latestIcon || undefined), 0);
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
        // Compare stringified content to detect actual changes (not just selection/focus)
        const newContentString = JSON.stringify({ content: newValue, icon });

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

    // Handle Emoji Select
    const onSelectEmoji = (emoji: any) => {
        const newIcon = emoji.skins[0].native;
        setIcon(newIcon);
        // Trigger save immediately for icon change
        if (latestContentRef.current) {
            // If a save is in progress, just update the latest icon for the next save
            if (savingRef.current) {
                latestIconRef.current = newIcon;
                setIsUnsaved(true);
            } else {
                handleSave(latestContentRef.current, newIcon);
            }
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

            switch (format) {
                case 'image': {
                    // Free for everyone - use print preview approach
                    toast.info('Opening print dialog for image export. Use "Save as PDF" or print to image.');
                    window.print();
                    break;
                }

                case 'markdown': {
                    // Pro feature
                    const event = new CustomEvent('export-requires-upgrade', {
                        detail: { message: `Export to Markdown requires a Pro or Unlimited subscription.` }
                    });
                    window.dispatchEvent(event);
                    break;
                }

                case 'html': {
                    // Pro feature
                    const event = new CustomEvent('export-requires-upgrade', {
                        detail: { message: `Export to HTML requires a Pro or Unlimited subscription.` }
                    });
                    window.dispatchEvent(event);
                    break;
                }

                case 'pdf': {
                    // Pro feature
                    const event = new CustomEvent('export-requires-upgrade', {
                        detail: { message: `Export to PDF requires a Pro or Unlimited subscription.` }
                    });
                    window.dispatchEvent(event);
                    break;
                }

                case 'docx': {
                    // Pro feature
                    const event = new CustomEvent('export-requires-upgrade', {
                        detail: { message: `Export to DOCX requires a Pro or Unlimited subscription.` }
                    });
                    window.dispatchEvent(event);
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
