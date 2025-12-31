'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose
} from '@/components/ui/sheet';
import {
    IconMessageCircle,
    IconSend,
    IconLoader2,
    IconTrash,
    IconShield,
    IconArrowBackUp,
    IconPencil,
    IconX,
    IconCornerDownRight,
    IconAlertTriangle,
    IconDownload,
    IconLock,
    IconDotsVertical,
    IconLockOff,
    IconMessageOff,
    IconFilter,
    IconBan,
    IconUserOff,
    IconUser
} from '@tabler/icons-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiClient, ShareComment } from '@/lib/api';
import { getDiceBearAvatar } from '@/lib/avatar';
import { deriveCommentKey, encryptComment, decryptComment, createMessageFingerprint, signMessageFingerprint } from '@/lib/comment-crypto';
import { keyManager } from '@/lib/key-manager';
import { uint8ArrayToHex } from '@/lib/crypto';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CommentSectionProps {
    shareId: string;
    shareCek?: Uint8Array;
    currentUser: { id: string; name: string; avatar: string } | null;
    isOwner?: boolean;
    className?: string;
}

type DecryptedComment = ShareComment & {
    decryptedContent: string;
    isEdited?: boolean;
    decryptionFailed?: boolean;
};

export function CommentSection({ shareId, shareCek, currentUser, isOwner, className }: CommentSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [comments, setComments] = useState<DecryptedComment[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [content, setContent] = useState('');

    // Edit/Reply state
    const [editingComment, setEditingComment] = useState<DecryptedComment | null>(null);
    const [replyingTo, setReplyingTo] = useState<DecryptedComment | null>(null);

    const [commentKey, setCommentKey] = useState<Uint8Array | null>(null);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [hasDecryptionError, setHasDecryptionError] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const [realIsOwner, setRealIsOwner] = useState(isOwner);

    // Update realIsOwner if prop changes
    useEffect(() => {
        setRealIsOwner(isOwner);
    }, [isOwner]);

    // Share settings state
    const [isLocked, setIsLocked] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'unread'>('recent');
    const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(0);

    // Banned users state
    const [showBannedUsers, setShowBannedUsers] = useState(false);
    const [bannedUsers, setBannedUsers] = useState<Array<{ id: string; name: string; email: string; avatarUrl: string; bannedAt: string }>>([]);
    const [userToBan, setUserToBan] = useState<{ id: string; name: string; avatarUrl: string } | null>(null);

    // Load last seen from local storage
    useEffect(() => {
        if (shareId) {
            const saved = localStorage.getItem(`share_last_seen_${shareId}`);
            if (saved) {
                setLastSeenTimestamp(parseInt(saved));
            }
        }
    }, [shareId]);

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize comment key

    // Initialize comment key
    useEffect(() => {
        if (shareCek) {
            deriveCommentKey(shareCek).then(setCommentKey);
        }
    }, [shareCek]);

    const fetchComments = useCallback(async (page = 1) => {
        if (!commentKey) return;
        setLoading(true);
        try {
            const response = await apiClient.getShareComments(shareId, page);

            // Allow checking ownership via count endpoint
            apiClient.getShareCommentCount(shareId).then(res => {
                if (res.success && res.data) {
                    setCommentCount(res.data.count);
                    if (res.data.isOwner !== undefined) {
                        setRealIsOwner(res.data.isOwner);
                    }
                    // Update lock/enable state from server
                    if (res.data.isLocked !== undefined) setIsLocked(res.data.isLocked);
                    if (res.data.isEnabled !== undefined) setIsEnabled(res.data.isEnabled);
                }
            }).catch(console.error);

            if (response.success && response.data) {
                let decryptionErrorFound = false;
                const decrypted = await Promise.all(
                    response.data.comments.map(async (c) => {
                        try {
                            const decryptedContent = await decryptComment(c.content, commentKey);
                            if (decryptedContent === '[Decryption Failed]') {
                                decryptionErrorFound = true;
                            }
                            const isEdited = !!(c.updatedAt && c.updatedAt !== c.createdAt);

                            return {
                                ...c,
                                decryptedContent,
                                isEdited,
                                decryptionFailed: decryptedContent === '[Decryption Failed]'
                            };
                        } catch (e) {
                            decryptionErrorFound = true;
                            return {
                                ...c,
                                decryptedContent: '[Decryption Failed]',
                                isEdited: false,
                                decryptionFailed: true
                            };
                        }
                    })
                );

                if (decryptionErrorFound) {
                    setHasDecryptionError(true);
                    toast.error("Security Warning", {
                        description: "Some messages could not be decrypted. Your encryption key may be incorrect."
                    });
                }

                if (page === 1) {
                    setComments(decrypted);
                } else {
                    setComments(prev => [...prev, ...decrypted]);
                }
                setPagination({
                    page: response.data.pagination.page,
                    totalPages: response.data.pagination.totalPages
                });
            }
        } catch (err) {
            console.error('Failed to fetch comments:', err);
            toast.error('Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [shareId, commentKey]);

    useEffect(() => {
        if (isOpen && commentKey) {
            fetchComments(1);
            // Update last seen in localStorage when opening
            const now = Date.now();
            localStorage.setItem(`share_last_seen_${shareId}`, now.toString());

            // Focus input on open
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [isOpen, commentKey, fetchComments, shareId]);

    // Fetch share settings (locked/enabled)
    useEffect(() => {
        if (isOpen && shareId) {
            apiClient.getShare(shareId).then(resp => {
                if (resp.success && resp.data) {
                    setIsLocked(!!resp.data.comments_locked);
                    setIsEnabled(!!resp.data.comments_enabled);
                }
            });
        }
    }, [isOpen, shareId]);

    // Polling for new comments / count every minute
    useEffect(() => {
        if (!shareId) return;

        const interval = setInterval(async () => {
            if (isOpen && commentKey) {
                await fetchComments(1);
            } else try {
                const response = await apiClient.getShareCommentCount(shareId);
                if (response.success && response.data) {
                    setCommentCount(response.data.count);
                }
            } catch (err) {
                // Silent fail for polling
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [isOpen, shareId, commentKey, fetchComments]);

    // Initial count fetch for the blue dot
    useEffect(() => {
        const fetchCount = async () => {
            try {
                const response = await apiClient.getShareCommentCount(shareId);
                if (response.success && response.data) {
                    setCommentCount(response.data.count);
                }
            } catch (err) {
                console.error('Failed to fetch comment count:', err);
            }
        };
        fetchCount();
    }, [shareId]);

    // Update count when comments change
    useEffect(() => {
        if (isOpen) {
            setCommentCount(comments.length);
        }
    }, [comments.length, isOpen]);

    // Auto-scroll to bottom when comments load or new comment added (chronological view)
    useEffect(() => {
        if (isOpen && comments.length > 0) {
            const timer = setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, comments.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !commentKey || submitting) return;

        if (hasDecryptionError) {
            toast.error("Cannot post comment", {
                description: "Your encryption key does not match this thread. Please check your password or URL."
            });
            return;
        }

        setSubmitting(true);
        try {
            const encryptedContent = await encryptComment(content, commentKey);

            // Cryptographic fingerprinting and signing
            let fingerprintHex = '';
            let signatureHex = '';
            let publicKeyHex = '';

            if (currentUser) {
                try {
                    const keys = await keyManager.getUserKeys();
                    const fingerprint = await createMessageFingerprint(content, currentUser.id);
                    const signature = await signMessageFingerprint(fingerprint, keys.keypairs.ed25519PrivateKey);

                    fingerprintHex = uint8ArrayToHex(fingerprint);
                    signatureHex = uint8ArrayToHex(signature);
                    publicKeyHex = keys.keypairs.ed25519PublicKey;
                } catch (cryptoErr) {
                    console.error('Failed to sign message:', cryptoErr);
                    // Continue without signature if key is missing (e.g. not logged in correctly or keys not loaded)
                }
            }

            if (editingComment) {
                // Update logic - check if changed
                if (content.trim() === editingComment.decryptedContent) {
                    setEditingComment(null);
                    setContent('');
                    setSubmitting(false);
                    return;
                }

                const response = await apiClient.updateShareComment(shareId, editingComment.id, {
                    content: encryptedContent,
                    fingerprint: fingerprintHex,
                    signature: signatureHex,
                    publicKey: publicKeyHex
                });
                if (response.success) {
                    const now = new Date().toISOString();
                    setComments(prev => prev.map(c => c.id === editingComment.id ? {
                        ...c,
                        decryptedContent: content,
                        content: encryptedContent,
                        updatedAt: now,
                        isEdited: true,
                        fingerprint: fingerprintHex,
                        signature: signatureHex,
                        publicKey: publicKeyHex
                    } : c));
                    setEditingComment(null);
                    setContent('');
                } else {
                    if (response.error?.toLowerCase().includes('banned')) {
                        toast.error("You are banned from commenting on this post.");
                    } else {
                        toast.error(response.error || 'Failed to update comment');
                    }
                }
            } else {
                // Create logic
                const response = await apiClient.addShareComment(shareId, {
                    content: encryptedContent,
                    parentId: replyingTo?.id || null,
                    fingerprint: fingerprintHex,
                    signature: signatureHex,
                    publicKey: publicKeyHex
                });

                if (response.success && response.data) {
                    const now = new Date().toISOString();
                    const newComment: DecryptedComment = {
                        ...response.data.comment,
                        userName: currentUser?.name || 'You',
                        avatarUrl: currentUser?.avatar || '',
                        decryptedContent: content,
                        updatedAt: now,
                        isEdited: false,
                        fingerprint: fingerprintHex,
                        signature: signatureHex,
                        publicKey: publicKeyHex
                    };

                    setComments(prev => [...prev, newComment]);
                    setContent('');
                    setReplyingTo(null);
                } else {
                    if (response.error?.toLowerCase().includes('banned')) {
                        toast.error("You are banned from commenting on this post.");
                    } else {
                        toast.error(response.error || 'Failed to submit comment');
                    }
                }
            }
        } catch (err: any) {
            console.error('Failed to submit comment:', err);
            toast.error('Failed to submit comment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (comment: DecryptedComment) => {
        if (comment.decryptionFailed) return;
        setEditingComment(comment);
        setReplyingTo(null);
        setContent(comment.decryptedContent);
    };

    const handleReply = (comment: DecryptedComment) => {
        if (comment.decryptionFailed) return;
        setReplyingTo(comment);
        setEditingComment(null);
        setContent('');
    };

    const cancelAction = () => {
        setEditingComment(null);
        setReplyingTo(null);
        setContent('');
    };

    const handleDelete = async (commentId: string) => {
        try {
            const response = await apiClient.deleteShareComment(shareId, commentId);
            if (response.success) {
                setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
            }
        } catch (err) {
            console.error('Failed to delete comment:', err);
            toast.error('Failed to delete comment');
        }
    };

    const toggleLock = async () => {
        try {
            const newLocked = !isLocked;
            const res = await apiClient.lockComments(shareId, newLocked);
            if (res.success) {
                setIsLocked(newLocked);
                toast.success(newLocked ? "Comments locked" : "Comments unlocked");
            }
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    const toggleEnabled = async () => {
        try {
            const newEnabled = !isEnabled;
            const res = await apiClient.setCommentsEnabled(shareId, newEnabled);
            if (res.success) {
                setIsEnabled(newEnabled);
                if (!newEnabled) setIsOpen(false);
                toast.success(newEnabled ? "Comments enabled" : "Comments disabled");
            }
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    const fetchBannedUsers = async () => {
        try {
            const res = await apiClient.getShareBannedUsers(shareId);
            if (res.success && res.data) {
                setBannedUsers(res.data.banned);
                setShowBannedUsers(true);
            }
        } catch (err) {
            toast.error("Failed to fetch banned users");
        }
    };

    const handleBanUser = (userId: string, userName: string, avatarUrl: string) => {
        setUserToBan({ id: userId, name: userName, avatarUrl });
    };

    const confirmBanUser = async () => {
        if (!userToBan) return;
        try {
            const res = await apiClient.banShareUser(shareId, userToBan.id);
            if (res.success) {
                toast.success(`User ${userToBan.name} banned`);
                setComments(prev => prev.filter(c => c.userId !== userToBan.id));
                if (showBannedUsers) fetchBannedUsers();
            }
        } catch (err) {
            toast.error("Failed to ban user");
        } finally {
            setUserToBan(null);
        }
    };

    const handleUnbanUser = async (userId: string) => {
        try {
            const res = await apiClient.unbanShareUser(shareId, userId);
            if (res.success) {
                toast.success("User unbanned");
                fetchBannedUsers();
            }
        } catch (err) {
            toast.error("Failed to unban user");
        }
    };

    // Organize comments into threads
    const threadedComments = useMemo(() => {
        let sorted = [...comments];

        // Root grouping logic
        const map = new Map<string, DecryptedComment[]>();
        const roots: DecryptedComment[] = [];

        sorted.forEach(c => {
            if (c.parentId) {
                const children = map.get(c.parentId) || [];
                children.push(c);
                map.set(c.parentId, children);
            } else {
                roots.push(c);
            }
        });

        // Apply root sorting
        if (sortBy === 'recent') {
            roots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Chronological for chat flow
        } else if (sortBy === 'oldest') {
            roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sortBy === 'unread') {
            roots.sort((a, b) => {
                const aIsUnread = new Date(a.createdAt).getTime() > lastSeenTimestamp;
                const bIsUnread = new Date(b.createdAt).getTime() > lastSeenTimestamp;
                if (aIsUnread && !bIsUnread) return -1;
                if (!aIsUnread && bIsUnread) return 1;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });
        }

        const result: { comment: DecryptedComment, isReply: boolean }[] = [];
        roots.forEach(root => {
            result.push({ comment: root, isReply: false });
            const children = map.get(root.id) || [];
            children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            children.forEach(child => {
                result.push({ comment: child, isReply: true });
            });
        });

        if (sortBy === 'unread' && result.length > 0) {
            // Unread first might break thread unity if we just sort results, 
            // but here we keep threads together and put "roots with unread" at top.
        }

        return result;
    }, [comments, sortBy, lastSeenTimestamp]);

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "fixed bottom-4 right-4 z-50 h-8 w-8 rounded-full opacity-50 hover:opacity-100 transition-all hover:bg-muted/50 text-muted-foreground",
                            className
                        )}
                        title="Encrypted Comments"
                    >
                        <IconMessageCircle className="h-4 w-4" />
                        {commentCount > 0 && (
                            <span className="absolute top-1 right-1 h-2 w-2 bg-blue-500 rounded-full border border-background shadow-xs animate-in fade-in zoom-in duration-300" />
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent
                    className="w-full sm:max-w-md flex flex-col p-0 gap-0 border-l shadow-2xl bg-background outline-none [&>button]:hidden"
                    onOpenAutoFocus={(e) => {
                        e.preventDefault();
                        textareaRef.current?.focus();
                    }}
                >
                    <TooltipProvider delayDuration={300}>
                        <SheetHeader className="px-4 py-3 border-b bg-muted/5 shrink-0 flex flex-row items-center justify-between space-y-0">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="text-primary">
                                        <IconMessageCircle className="h-4 w-4" />
                                    </div>
                                    <SheetTitle className="text-base font-bold tracking-tight">Comments</SheetTitle>
                                </div>
                                <div className="flex items-center gap-1 opacity-30 px-0.5">
                                    <IconShield className="h-2 w-2" />
                                    <span className="text-[7px] font-black uppercase tracking-[0.2em]">E2EE Secured</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Download Button */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                                            onClick={() => {
                                                const dataStr = JSON.stringify(comments, null, 2);
                                                const blob = new Blob([dataStr], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `share-${shareId}-comments.json`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                URL.revokeObjectURL(url);
                                            }}
                                        >
                                            <IconDownload className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] font-black">Download JSON</TooltipContent>
                                </Tooltip>

                                {realIsOwner && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                                                onClick={fetchBannedUsers}
                                            >
                                                <IconUserOff className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px] font-black">Banned Users</TooltipContent>
                                    </Tooltip>
                                )}

                                {/* Filter Button */}
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all">
                                                    <IconFilter className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px] font-black">Sort</TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent align="end" className="w-32 text-xs font-bold">
                                        <DropdownMenuItem onClick={() => setSortBy('recent')} className="gap-2">
                                            <div className={cn("h-1.5 w-1.5 rounded-full bg-primary", sortBy !== 'recent' && "opacity-0")} />
                                            Recent
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy('oldest')} className="gap-2">
                                            <div className={cn("h-1.5 w-1.5 rounded-full bg-primary", sortBy !== 'oldest' && "opacity-0")} />
                                            Oldest
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy('unread')} className="gap-2">
                                            <div className={cn("h-1.5 w-1.5 rounded-full bg-primary", sortBy !== 'unread' && "opacity-0")} />
                                            Unread
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Options Button */}
                                {realIsOwner && (
                                    <DropdownMenu modal={false}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all">
                                                        <IconDotsVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-[10px] font-black">Options</TooltipContent>
                                        </Tooltip>
                                        <DropdownMenuContent align="end" className="w-48 text-xs font-bold">
                                            <DropdownMenuItem onClick={toggleLock} className="gap-2 cursor-pointer transition-colors">
                                                {isLocked ? <IconLockOff className="h-4 w-4" /> : <IconLock className="h-4 w-4" />}
                                                {isLocked ? "Unlock Comments" : "Lock Comments"}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={toggleEnabled} className={cn("gap-2 cursor-pointer transition-colors", isEnabled ? "text-destructive focus:text-destructive" : "text-green-500 focus:text-green-500")}>
                                                {isEnabled ? <IconMessageOff className="h-4 w-4" /> : <IconMessageCircle className="h-4 w-4" />}
                                                {isEnabled ? "Disable Comments" : "Enable Comments"}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                {/* Custom Close Button */}
                                <SheetClose asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-lg transition-all ml-1">
                                        <IconX className="h-4 w-4" />
                                    </Button>
                                </SheetClose>
                            </div>
                        </SheetHeader>
                    </TooltipProvider>

                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20" ref={scrollAreaRef as any}>
                        <div className="p-4 pb-24 flex flex-col">
                            <div className="flex items-center justify-center py-2 px-1 mb-6">
                                <div className="h-px bg-muted flex-1" />
                                <span className="px-3 text-[9px] uppercase tracking-widest font-black text-muted-foreground/40 flex items-center gap-2">
                                    <IconShield className="h-2.5 w-2.5" />
                                    E2EE Connection Active
                                </span>
                                <div className="h-px bg-muted flex-1" />
                            </div>

                            {pagination.page < pagination.totalPages && !loading && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-[10px] text-muted-foreground font-medium uppercase tracking-widest hover:bg-transparent hover:text-foreground"
                                    onClick={() => fetchComments(pagination.page + 1)}
                                >
                                    Load older messages
                                </Button>
                            )}

                            {threadedComments.length === 0 && !loading && commentKey && (
                                <div className="text-center py-24 px-8">
                                    <div className="bg-muted/30 h-16 w-16 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                                        <IconMessageCircle className="h-8 w-8 text-primary/30" />
                                    </div>
                                    <h3 className="text-sm font-bold mb-2">No comments yet</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[180px] mx-auto">Be the first to share your thoughts securely. All messages are encrypted.</p>
                                </div>
                            )}

                            {!commentKey && isOpen && (
                                <div className="text-center py-24 px-8">
                                    <div className="bg-muted/30 h-16 w-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                        <IconLock className="h-8 w-8 text-primary/30" />
                                    </div>
                                    <h3 className="text-sm font-bold mb-2">Encryption Key Required</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">Please enter the share password to decrypt this conversation.</p>
                                </div>
                            )}

                            {threadedComments.map(({ comment, isReply }, index) => {
                                const isMe = !!currentUser && currentUser.id === comment.userId;
                                const canDelete = !!currentUser && (isMe || realIsOwner);

                                // Grouping logic: check if next comment is from same user
                                const nextComment = threadedComments[index + 1];
                                const isNextSameUser = nextComment && nextComment.comment.userId === comment.userId;
                                const isLastInGroup = !isNextSameUser;

                                return (
                                    <div
                                        key={comment.id}
                                        className={cn(
                                            "flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                            isMe ? "items-end" : "items-start",
                                            isLastInGroup ? "mb-4" : "mb-0.5" // Tighter spacing for groups
                                        )}
                                    >
                                        {isReply && (
                                            <div className={cn(
                                                "flex items-center gap-2 mb-1 opacity-50 px-2 max-w-[90%]",
                                                isMe ? "justify-end flex-row-reverse" : "justify-start"
                                            )}>
                                                <IconCornerDownRight className={cn("h-3 w-3 shrink-0", isMe && "rotate-180")} />
                                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground overflow-hidden">
                                                    <span className="font-black shrink-0">@{(() => {
                                                        const p = comments.find(c => c.id === comment.parentId);
                                                        return p ? (p.userName || p.userEmail?.split('@')[0] || '[deleted]') : 'deleted';
                                                    })()}</span>
                                                    <span className="truncate italic opacity-70 leading-none">{comments.find(c => c.id === comment.parentId)?.decryptedContent}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className={cn(
                                            "flex gap-2 group relative w-full items-end", // Items-end for bottom alignment
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}>
                                            {/* Avatar Column - Fixed Width */}
                                            <div className="w-8 shrink-0 flex justify-center">
                                                {isLastInGroup ? (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger className="outline-none">
                                                            <Avatar className="h-6 w-6 border bg-background shadow-xs hover:ring-2 ring-primary/20 transition-all cursor-pointer">
                                                                <AvatarImage src={comment.avatarUrl || getDiceBearAvatar(comment.userId)} />
                                                                <AvatarFallback className="text-[8px] font-bold">{(comment.userName || comment.userEmail?.split('@')[0] || 'DEL').substring(0, 3).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start" className="w-56" sideOffset={8}>
                                                            <div className="flex items-center gap-3 p-2 border-b mb-1">
                                                                <Avatar className="h-8 w-8 border">
                                                                    <AvatarImage src={comment.avatarUrl || getDiceBearAvatar(comment.userId)} />
                                                                    <AvatarFallback>{(comment.userName || comment.userEmail?.split('@')[0] || 'DEL').substring(0, 3).toUpperCase()}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col overflow-hidden">
                                                                    <span className="text-sm font-bold truncate">{comment.userName || '[deleted]'}</span>
                                                                    {comment.userEmail && <span className="text-[10px] text-muted-foreground truncate">{comment.userEmail}</span>}
                                                                </div>
                                                            </div>

                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    navigator.clipboard.writeText(comment.userId);
                                                                    toast.success("User ID copied");
                                                                }}
                                                                className="text-xs cursor-pointer gap-2"
                                                            >
                                                                <IconUser className="h-3.5 w-3.5" />
                                                                Copy User ID
                                                            </DropdownMenuItem>

                                                            {realIsOwner && currentUser?.id !== comment.userId && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleBanUser(comment.userId, comment.userName || '[deleted]', comment.avatarUrl || getDiceBearAvatar(comment.userId))}
                                                                    className="text-xs text-destructive focus:text-destructive cursor-pointer gap-2"
                                                                >
                                                                    <IconBan className="h-3.5 w-3.5" />
                                                                    Ban User
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                ) : (
                                                    <div className="w-6" /> // Spacer
                                                )}
                                            </div>

                                            <div className={cn(
                                                "flex flex-col gap-0.5 min-w-0 flex-1 max-w-[85%]",
                                                isMe ? "items-end" : "items-start"
                                            )}>

                                                {(!threadedComments[index - 1] || threadedComments[index - 1].comment.userId !== comment.userId || isReply) && (
                                                    <div className={cn(
                                                        "flex items-center gap-2 px-1 mb-0.5",
                                                        isMe ? "flex-row-reverse" : "flex-row"
                                                    )}>
                                                        <span className="text-[10px] font-black text-foreground/70 uppercase tracking-tighter leading-none">
                                                            {isMe ? "You" : (comment.userName || comment.userEmail?.split('@')[0] || '[deleted]')}
                                                        </span>
                                                        <span className="text-[8px] text-muted-foreground/30 font-bold uppercase tracking-widest leading-none">
                                                            {formatDate(comment.createdAt)}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={cn(
                                                    "text-[13px] px-3 py-2 shadow-xs break-words relative leading-snug",
                                                    isMe
                                                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                                                        : "bg-muted/50 border-none rounded-2xl rounded-bl-sm",
                                                    // Adjust corners for grouping
                                                    !isLastInGroup && isMe && "rounded-br-2xl border-r-2 border-r-transparent", // connect visually?
                                                    // Actually separate bubbles is better for "discord" style usually, just tight spacing.

                                                    comment.decryptionFailed && "opacity-70 bg-destructive/10 text-destructive border-destructive/20 italic"
                                                )}>
                                                    {comment.decryptionFailed && <IconAlertTriangle className="h-3 w-3 inline mr-1.5 -mt-0.5" />}
                                                    {comment.decryptedContent}
                                                    {!!comment.isEdited && !comment.decryptionFailed && (
                                                        <span className="ml-1.5 opacity-40 text-[7px] font-black uppercase tracking-[0.05em] align-baseline">edited</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 self-center mb-1",
                                                isMe ? "flex-row-reverse" : "flex-row"
                                            )}>
                                                {!isReply && !comment.decryptionFailed && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground/30"
                                                        onClick={() => handleReply(comment)}
                                                        title="Reply"
                                                    >
                                                        <IconArrowBackUp className="h-3 w-3" />
                                                    </Button>
                                                )}

                                                {isMe && !comment.decryptionFailed && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 rounded-full hover:bg-foreground/5 text-muted-foreground/30"
                                                        onClick={() => handleEdit(comment)}
                                                        title="Edit"
                                                    >
                                                        <IconPencil className="h-3 w-3" />
                                                    </Button>
                                                )}

                                                {canDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground/30"
                                                        onClick={() => handleDelete(comment.id)}
                                                        title="Delete"
                                                    >
                                                        <IconTrash className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div ref={scrollRef} className="h-px w-full" />

                            {loading && (
                                <div className="flex justify-center py-4">
                                    <IconLoader2 className="h-5 w-5 animate-spin text-primary/30" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 pb-8 border-t bg-background/95 backdrop-blur-md shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.05)]">
                        {currentUser ? (
                            <div className="space-y-3">
                                {(replyingTo || editingComment) && (
                                    <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-3 border border-primary/10 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                                {editingComment ? <IconPencil className="h-3.5 w-3.5 text-primary" /> : <IconArrowBackUp className="h-3.5 w-3.5 text-primary" />}
                                            </div>
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                    {editingComment ? "Modifying message" : `Replying to @${replyingTo?.userName || replyingTo?.userEmail?.split('@')[0] || 'Anonymous'}`}
                                                </span>
                                                <p className="text-xs text-muted-foreground/70 truncate italic leading-none">
                                                    {editingComment ? editingComment.decryptedContent : replyingTo?.decryptedContent}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={cancelAction} className="h-8 w-8 rounded-full hover:bg-primary/10 transition-colors shrink-0 -mr-1">
                                            <IconX className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                <form onSubmit={handleSubmit} className="relative flex gap-2">
                                    {isLocked && !isOwner ? (
                                        <div className="w-full h-12 rounded-xl bg-muted/50 border flex items-center justify-center gap-2 text-muted-foreground text-xs font-bold">
                                            <IconLock className="h-3.5 w-3.5" />
                                            Comments are locked
                                        </div>
                                    ) : !isEnabled ? (
                                        <div className="w-full h-12 rounded-xl bg-muted/50 border flex items-center justify-center gap-2 text-muted-foreground text-xs font-bold">
                                            <IconMessageOff className="h-3.5 w-3.5" />
                                            Comments are disabled
                                        </div>
                                    ) : (
                                        <>
                                            <Textarea
                                                ref={textareaRef}
                                                placeholder={replyingTo ? `Replying to @${replyingTo.userName}...` : "Message..."}
                                                className="min-h-[44px] max-h-[120px] bg-muted/30 border-none focus-visible:ring-0 focus-visible:bg-muted/50 rounded-xl resize-none py-3 px-4 text-[13px] leading-relaxed pr-10 scrollbar-thin scrollbar-thumb-muted-foreground/10"
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSubmit(e);
                                                    }
                                                    if (e.key === 'Escape') {
                                                        if (editingComment || replyingTo) {
                                                            cancelAction();
                                                        }
                                                    }
                                                }}
                                                disabled={submitting}
                                            />
                                            <div className="absolute right-2 bottom-1.5 flex items-center">
                                                <Button
                                                    type="submit"
                                                    size="icon"
                                                    disabled={!content.trim() || submitting}
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg transition-all",
                                                        content.trim() ? "bg-primary text-primary-foreground shadow-sm hover:translate-y-[-1px]" : "bg-transparent text-muted-foreground/20 hover:bg-transparent"
                                                    )}
                                                >
                                                    {submitting ? (
                                                        <IconLoader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <IconSend className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </form>
                                <div className="text-[9px] text-muted-foreground/30 font-black text-center mt-2 uppercase tracking-widest">
                                    {editingComment ? "Editing Message • Esc to cancel" : replyingTo ? "Replying • Esc to cancel" : "End-to-end encrypted"}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-muted/40 rounded-2xl p-6 text-center space-y-5 border border-dashed border-muted-foreground/20">
                                <div className="space-y-1.5">
                                    <h4 className="text-sm font-bold tracking-tight">Join the conversation</h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed px-4">Log in to leave a secure, end-to-end encrypted comment on this share.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                    <Button variant="outline" size="sm" className="h-9 text-xs font-bold px-6 rounded-full border-2 hover:bg-muted transition-all" onClick={() => window.location.href = '/login?utm_source=share_comments&utm_medium=referral&utm_campaign=share_auth'}>Log In</Button>
                                    <Button size="sm" className="h-9 text-xs font-bold px-6 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all" onClick={() => window.location.href = '/signup?utm_source=share_comments&utm_medium=referral&utm_campaign=share_auth'}>Get Started</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet >

            <Dialog open={showBannedUsers} onOpenChange={setShowBannedUsers}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Banned Users</DialogTitle>
                        <DialogDescription>
                            Manage users who are banned from commenting on your shares.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 mt-4 max-h-[300px] overflow-y-auto pr-2">
                        {bannedUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
                                <IconUserOff className="h-8 w-8 opacity-20" />
                                <p className="text-sm font-medium">No banned users</p>
                            </div>
                        ) : (
                            bannedUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border bg-card/50 hover:bg-card/80 transition-colors shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border-2 border-background shadow-xs">
                                            <AvatarImage src={user.avatarUrl} />
                                            <AvatarFallback className="font-bold text-xs bg-muted text-muted-foreground">
                                                {user.name?.substring(0, 2).toUpperCase() || 'AN'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold leading-none">{user.name || 'Anonymous'}</span>
                                            <span className="text-[10px] font-medium text-muted-foreground/70 truncate max-w-[150px]">{user.email}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleUnbanUser(user.id)}
                                        className="h-7 px-3 text-xs font-semibold hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all"
                                    >
                                        Unban
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>


            <AlertDialog open={!!userToBan} onOpenChange={(open) => !open && setUserToBan(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ban User</AlertDialogTitle>
                        <AlertDialogDescription className="flex flex-col gap-4 py-2">
                            <span className="text-sm text-muted-foreground">
                                Are you sure you want to ban <span className="font-bold text-foreground">{userToBan?.name}</span>? This will permanently remove all their comments.
                            </span>
                            {userToBan && (
                                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                                    <Avatar className="h-10 w-10 border shadow-xs">
                                        <AvatarImage src={userToBan.avatarUrl} />
                                        <AvatarFallback>{(userToBan.name?.substring(0, 2) || 'AN').toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">{userToBan.name || 'Anonymous'}</span>
                                        <span className="text-xs text-muted-foreground">User ID: {userToBan.id}</span>
                                    </div>
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmBanUser} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Ban User</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
