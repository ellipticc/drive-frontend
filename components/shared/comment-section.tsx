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
    SheetTrigger
} from '@/components/ui/sheet';
import {
    IconMessageCircle,
    IconSend,
    IconLoader2,
    IconTrash,
    IconDotsVertical,
    IconShield,
    IconArrowBackUp,
    IconPencil,
    IconX,
    IconCornerDownRight,
    IconAlertTriangle,
    IconDownload,
    IconLock
} from '@tabler/icons-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiClient, ShareComment } from '@/lib/api';
import { getDiceBearAvatar } from '@/lib/avatar';
import { deriveCommentKey, encryptComment, decryptComment } from '@/lib/comment-crypto';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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
        }
    }, [isOpen, commentKey, fetchComments]);

    // Polling for new comments / count every minute
    useEffect(() => {
        if (!shareId) return;

        const interval = setInterval(async () => {
            if (isOpen && commentKey) {
                await fetchComments(1);
            } else {
                try {
                    const response = await apiClient.getShareCommentCount(shareId);
                    if (response.success && response.data) {
                        setCommentCount(response.data.count);
                    }
                } catch (err) {
                    console.error('Failed to poll comment count:', err);
                }
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

            if (editingComment) {
                // Update logic
                const response = await apiClient.updateShareComment(shareId, editingComment.id, { content: encryptedContent });
                if (response.success) {
                    const now = new Date().toISOString();
                    setComments(prev => prev.map(c => c.id === editingComment.id ? {
                        ...c,
                        decryptedContent: content,
                        content: encryptedContent,
                        updatedAt: now,
                        isEdited: true
                    } : c));
                    setEditingComment(null);
                    setContent('');
                }
            } else {
                // Create logic
                const response = await apiClient.addShareComment(shareId, {
                    content: encryptedContent,
                    parentId: replyingTo?.id || null
                });

                if (response.success && response.data) {
                    const now = new Date().toISOString();
                    const newComment: DecryptedComment = {
                        ...response.data.comment,
                        decryptedContent: content,
                        updatedAt: now,
                        isEdited: false
                    };

                    setComments(prev => [...prev, newComment]);
                    setContent('');
                    setReplyingTo(null);
                }
            }
        } catch (err) {
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

    // Organize comments into threads
    const threadedComments = useMemo(() => {
        const map = new Map<string, DecryptedComment[]>();
        const roots: DecryptedComment[] = [];

        // Group by parentId
        comments.forEach(c => {
            if (c.parentId) {
                const children = map.get(c.parentId) || [];
                children.push(c);
                map.set(c.parentId, children);
            } else {
                roots.push(c);
            }
        });

        // Sort roots by date (oldest first for "most recent at bottom")
        roots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Build the final list: Root followed by its children (oldest children first)
        const result: { comment: DecryptedComment, isReply: boolean }[] = [];
        roots.forEach(root => {
            result.push({ comment: root, isReply: false });
            const children = map.get(root.id) || [];
            children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            children.forEach(child => {
                result.push({ comment: child, isReply: true });
            });
        });

        return result;
    }, [comments]);

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
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0 border-l shadow-2xl">
                <SheetHeader className="p-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <IconMessageCircle className="h-4 w-4 text-primary" />
                                <SheetTitle className="text-base font-semibold">Comments</SheetTitle>
                            </div>
                            <SheetDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
                                <IconShield className="h-3 w-3" />
                                End-to-end encrypted
                            </SheetDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
                            title="Download comments JSON"
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
                            <IconDownload className="h-4 w-4" />
                        </Button>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1" ref={scrollAreaRef}>
                    <div className="p-4 space-y-4">
                        {pagination.page < pagination.totalPages && !loading && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-[10px] text-muted-foreground font-medium uppercase tracking-widest hover:bg-transparent hover:text-foreground mb-4"
                                onClick={() => fetchComments(pagination.page + 1)}
                            >
                                Load older messages
                            </Button>
                        )}

                        {threadedComments.length === 0 && !loading && commentKey && (
                            <div className="text-center py-20 px-8">
                                <div className="bg-muted/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <IconMessageCircle className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <h3 className="text-sm font-medium mb-1">No comments yet</h3>
                                <p className="text-xs text-muted-foreground">Be the first to share your thoughts securely.</p>
                            </div>
                        )}

                        {!commentKey && isOpen && (
                            <div className="text-center py-20 px-8">
                                <div className="bg-muted/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <IconLock className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <h3 className="text-sm font-medium mb-1">Encryption Key Required</h3>
                                <p className="text-xs text-muted-foreground">Please enter the share password to view comments.</p>
                            </div>
                        )}

                        {threadedComments.map(({ comment, isReply }) => {
                            const isMe = !!currentUser && currentUser.id === comment.userId;
                            const canDelete = !!currentUser && (isMe || isOwner);

                            return (
                                <div
                                    key={comment.id}
                                    className={cn(
                                        "flex flex-col gap-1 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                        isReply && (isMe ? "pr-10" : "pl-10"),
                                        isMe ? "items-end ml-auto" : "items-start mr-auto"
                                    )}
                                >
                                    <div className={cn(
                                        "flex gap-3 items-start max-w-full relative",
                                        isMe ? "flex-row-reverse" : "flex-row"
                                    )}>
                                        {isReply && (
                                            <IconCornerDownRight className={cn(
                                                "h-3 w-3 text-muted-foreground/30 absolute top-1.5",
                                                isMe ? "-right-5 rotate-180" : "-left-5"
                                            )} />
                                        )}
                                        <Avatar className="h-8 w-8 shrink-0 border bg-background shadow-xs mt-0.5">
                                            <AvatarImage src={comment.avatarUrl || getDiceBearAvatar(comment.userId)} />
                                            <AvatarFallback className="text-[10px]">{comment.userName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>

                                        <div className={cn(
                                            "group relative max-w-[85%] space-y-1 flex flex-col",
                                            isMe ? "items-end text-right" : "items-start text-left"
                                        )}>
                                            <div className={cn(
                                                "flex items-baseline gap-2 mb-0.5 px-1",
                                                isMe ? "flex-row-reverse" : "flex-row"
                                            )}>
                                                <span className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-tight">
                                                    {isMe ? "You" : comment.userName}
                                                    {isOwner && comment.userId === currentUser?.id && " (Owner)"}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/40 font-medium">
                                                    {formatDate(comment.createdAt)}
                                                </span>
                                            </div>

                                            <div className={cn(
                                                "text-sm px-3 py-2 shadow-sm break-words",
                                                isMe
                                                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                                                    : "bg-muted/50 border rounded-2xl rounded-tl-sm",
                                                comment.decryptionFailed && "opacity-70 bg-destructive/10 text-destructive border-destructive/20 italic"
                                            )}>
                                                {comment.decryptionFailed && <IconAlertTriangle className="h-3 w-3 inline mr-1.5 -mt-0.5" />}
                                                {comment.decryptedContent}
                                                {!!comment.isEdited && !comment.decryptionFailed && (
                                                    <span className="ml-1.5 opacity-60 text-[10px] italic">(edited)</span>
                                                )}
                                            </div>

                                            <div className={cn(
                                                "flex items-center gap-3 px-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                                isMe ? "flex-row-reverse" : "flex-row"
                                            )}>
                                                {!isReply && !comment.decryptionFailed && (
                                                    <button
                                                        onClick={() => handleReply(comment)}
                                                        className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                                    >
                                                        <IconArrowBackUp className="h-3 w-3" /> Reply
                                                    </button>
                                                )}

                                                {isMe && !comment.decryptionFailed && (
                                                    <button
                                                        onClick={() => handleEdit(comment)}
                                                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                                    >
                                                        <IconPencil className="h-3 w-3" /> Edit
                                                    </button>
                                                )}

                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(comment.id)}
                                                        className="text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                                                    >
                                                        <IconTrash className="h-3 w-3" /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div ref={scrollRef} className="h-px" />

                        {loading && (
                            <div className="flex justify-center py-4">
                                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                            </div>
                        )}
                    </div>
                    <div className="h-6" /> {/* Extra padding for scroll space */}
                </ScrollArea>

                <div className="p-4 pb-8 border-t bg-background/95 backdrop-blur-md shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.05)]">
                    {currentUser ? (
                        <div className="space-y-3">
                            {(replyingTo || editingComment) && (
                                <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 border animate-in slide-in-from-bottom-2 duration-200">
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        <span className="text-[10px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                            {editingComment ? <IconPencil className="h-2.5 w-2.5" /> : <IconArrowBackUp className="h-2.5 w-2.5" />}
                                            {editingComment ? "Editing message" : `Replying to ${replyingTo?.userName}`}
                                        </span>
                                        <p className="text-xs text-muted-foreground truncate italic">
                                            {editingComment ? editingComment.decryptedContent : replyingTo?.decryptedContent}
                                        </p>
                                    </div>
                                    <button onClick={cancelAction} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center shrink-0">
                                        <IconX className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="relative group">
                                <Textarea
                                    placeholder={replyingTo ? "Write a reply..." : "Write a secure comment..."}
                                    className="min-h-[80px] bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl resize-none py-3 pr-10 text-sm placeholder:text-muted-foreground/50"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={submitting || !content.trim()}
                                    className={cn(
                                        "absolute bottom-2.5 right-2.5 h-7 w-7 rounded-lg transition-all shadow-sm",
                                        content.trim() ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
                                    )}
                                >
                                    {submitting ? (
                                        <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <IconSend className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </form>
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[9px] text-muted-foreground/60 italic">
                                    Shift + Enter for new line
                                </p>
                                <div className="flex items-center gap-1.5 text-[9px] text-primary/70 font-medium">
                                    <IconShield className="h-2.5 w-2.5" />
                                    End-to-End Encrypted
                                </div>
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
        </Sheet>
    );
}
