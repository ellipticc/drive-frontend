import React, { useState, useRef, useEffect, useCallback } from "react";
import { IconPlus, IconChevronDown, IconArrowUp, IconX, IconFileText, IconLoader2, IconCheck, IconArchive, IconBrain } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";

export const Icons = {
    Plus: IconPlus,
    Thinking: IconBrain,
    SelectArrow: IconChevronDown,
    ArrowUp: IconArrowUp,
    X: IconX,
    FileText: IconFileText,
    Loader2: IconLoader2,
    Check: IconCheck,
    Archive: IconArchive,
};

interface AttachedFile {
    id: string;
    file: File;
    type: string;
    preview: string | null;
}

interface FilePreviewCardProps {
    file: AttachedFile;
    onRemove: (id: string) => void;
}

const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, onRemove }) => {
    const isImage = file.type.startsWith("image/") && file.preview;

    return (
        <div className={cn(
            "relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-border bg-muted/50 transition-all hover:border-muted-foreground/50",
            "animate-in fade-in zoom-in-95 duration-200"
        )}>
            {isImage ? (
                <div className="w-full h-full relative">
                    <img src={file.preview!} alt={file.file.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                </div>
            ) : (
                <div className="w-full h-full p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-background rounded">
                            <Icons.FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                            {file.file.name.split('.').pop()}
                        </span>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground truncate" title={file.file.name}>
                            {file.file.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            {formatFileSize(file.file.size)}
                        </p>
                    </div>
                </div>
            )}

            {/* Remove Button Overlay */}
            <button
                onClick={() => onRemove(file.id)}
                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Icons.X className="w-3 h-3" />
            </button>
        </div>
    );
};

// 2. Model Selector
interface Model {
    id: string;
    name: string;
    description: string;
    badge?: string;
}

interface ModelSelectorProps {
    models: Model[];
    selectedModel: string;
    onSelect: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModel, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentModel = models.find(m => m.id === selectedModel) || models[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "inline-flex items-center justify-center relative shrink-0 transition font-base duration-300 h-8 rounded-xl px-3 min-w-[4rem] active:scale-[0.98] whitespace-nowrap !text-xs pl-2.5 pr-2 gap-1",
                    isOpen
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
            >
                <div className="font-ui inline-flex gap-[3px] text-[14px] h-[14px] leading-none items-baseline">
                    <div className="flex items-center gap-[4px]">
                        <div className="whitespace-nowrap select-none font-medium">{currentModel.name}</div>
                    </div>
                </div>
                <div className="flex items-center justify-center opacity-75" style={{ width: '20px', height: '20px' }}>
                    <Icons.SelectArrow className={cn("shrink-0 opacity-75 transition-transform duration-200", isOpen && 'rotate-180')} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-[260px] bg-popover border border-border rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col p-1.5 animate-in fade-in zoom-in-95 origin-bottom-right">
                    {models.map(model => (
                        <button
                            key={model.id}
                            onClick={() => {
                                onSelect(model.id);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between group transition-colors hover:bg-muted"
                        >
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-semibold text-foreground">
                                        {model.name}
                                    </span>
                                    {model.badge && (
                                        <span className={cn(
                                            "px-1.5 py-[1px] rounded-full text-[10px] font-medium border",
                                            model.badge === 'Upgrade'
                                                ? 'border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-500/30 dark:text-blue-400 dark:bg-blue-500/10'
                                                : 'border-border text-muted-foreground'
                                        )}>
                                            {model.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    {model.description}
                                </span>
                            </div>
                            {selectedModel === model.id && (
                                <Icons.Check className="w-4 h-4 text-primary mt-1" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// 3. Main Enhanced Prompt Input Component
interface EnhancedPromptInputProps {
    onSubmit: (value: string, attachments: File[]) => Promise<void>;
    isLoading?: boolean;
    onStop?: () => void;
    model?: string;
    onModelChange?: (model: string) => void;
}

export const EnhancedPromptInput: React.FC<EnhancedPromptInputProps> = ({
    onSubmit,
    isLoading,
    onStop,
    model: externalModel,
    onModelChange
}) => {
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [localModel, setLocalModel] = useState("llama-3.1-8b-instant");
    const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);

    const effectiveModel = externalModel || localModel;
    const handleModelChange = onModelChange || setLocalModel;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const models = [
        { id: "llama-3.1-8b-instant", name: "Llama 3.1", description: "Fastest response time" },
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3", description: "Better reasoning & detail" },
        { id: "mixtral-8x7b-32768", name: "Mixtral", description: "Balanced performance" }
    ];

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 384) + "px";
        }
    }, [message]);

    // File Handling
    const handleFiles = useCallback((newFilesList: FileList | File[]) => {
        const newFiles = Array.from(newFilesList).map(file => {
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                type: isImage ? 'image/unknown' : (file.type || 'application/octet-stream'),
                preview: isImage ? URL.createObjectURL(file) : null,
            };
        });

        setFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) pastedFiles.push(file);
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            handleFiles(pastedFiles);
            return;
        }
    };

    const handleSend = async () => {
        if ((!message.trim() && files.length === 0) || isLoading) return;

        const currentFiles = files.map(f => f.file);

        try {
            await onSubmit(message, currentFiles);
            setMessage("");
            setFiles([]);
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = message.trim() || files.length > 0;

    return (
        <div
            className={cn(
                "relative w-full max-w-3xl mx-auto transition-all duration-300 font-sans",
                isDragging && "scale-[1.02]"
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Main Container */}
            <div className={cn(
                "flex flex-col mx-2 md:mx-0 items-stretch transition-all duration-200 relative z-10 rounded-3xl border border-border bg-background shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:ring-1 focus-within:ring-ring/20",
                isLoading && "opacity-80 pointer-events-none"
            )}>

                <div className="flex flex-col px-4 pt-4 pb-3 gap-2">

                    {/* 1. Attached Files */}
                    {files.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
                            {files.map(file => (
                                <FilePreviewCard
                                    key={file.id}
                                    file={file}
                                    onRemove={id => setFiles(prev => prev.filter(f => f.id !== id))}
                                />
                            ))}
                        </div>
                    )}

                    {/* 2. Input Area */}
                    <div className="relative mb-1">
                        <div className="max-h-96 w-full overflow-y-auto custom-scrollbar font-sans break-words min-h-[2.5rem] pl-1">
                            <textarea
                                ref={textareaRef}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onPaste={handlePaste}
                                onKeyDown={handleKeyDown}
                                placeholder="How can I help you today?"
                                className="w-full bg-transparent border-0 outline-none text-foreground text-[16px] placeholder:text-muted-foreground resize-none overflow-hidden py-0 leading-relaxed block font-normal antialiased"
                                rows={1}
                                autoFocus
                                style={{ minHeight: '1.5em' }}
                            />
                        </div>
                    </div>

                    {/* 3. Action Bar */}
                    <div className="flex gap-2 w-full items-center justify-between">
                        {/* Left Tools */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                type="button"
                                aria-label="Attach file"
                            >
                                <Icons.Plus className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                                className={cn(
                                    "h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
                                    isThinkingEnabled
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                                aria-label="Extended thinking"
                            >
                                <Icons.Thinking className="w-5 h-5" />
                            </button>

                            <ModelSelector
                                models={models}
                                selectedModel={effectiveModel}
                                onSelect={handleModelChange}
                            />
                        </div>

                        {/* Right Tools (Send/Stop) */}
                        <div>
                            {isLoading ? (
                                <button
                                    onClick={onStop}
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
                                    type="button"
                                    aria-label="Stop generation"
                                >
                                    <Icons.Loader2 className="w-4 h-4 animate-spin" /> {/* Or a Stop icon */}
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={!hasContent}
                                    className={cn(
                                        "inline-flex items-center justify-center h-8 w-8 rounded-xl transition-all shadow-sm",
                                        hasContent
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                    type="button"
                                    aria-label="Send message"
                                >
                                    <Icons.ArrowUp className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-background/80 border-2 border-dashed border-primary rounded-3xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none animate-in fade-in duration-200">
                    <Icons.Archive className="w-10 h-10 text-primary mb-2 animate-bounce" />
                    <p className="text-primary font-medium">Drop files to upload</p>
                </div>
            )}

            {/* Hidden Input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                }}
                className="hidden"
            />
        </div>
    );
};
