"use client";

import React, { useState, useEffect } from "react";
import { IconPhoto, IconLoader2 } from "@tabler/icons-react";
import { apiClient } from "@/lib/api";
import { decryptData } from "@/lib/crypto";
import { unwrapCEK, DownloadEncryption } from "@/lib/download";
import { keyManager } from "@/lib/key-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { FileIcon } from "@/components/file-icon";

// Global cache for thumbnails to prevent re-fetching/decrypting
// Key: fileId
// Value: { url: blobUrl, refCount: number, timeout: NodeJS.Timeout }
const thumbnailCache = new Map<string, { url: string; refCount: number; timeout?: NodeJS.Timeout }>();

interface FileThumbnailProps {
    fileId: string;
    mimeType?: string;
    name: string;
    className?: string; // Wrapper class
    iconClassName?: string; // Fallback icon class
    encryption?: {
        iv: string;
        salt: string;
        wrappedCek: string;
        fileNoncePrefix: string;
        cekNonce: string;
        kyberCiphertext: string;
        nonceWrapKyber: string;
    };
    thumbnailPath?: string; // Optimization: If we know it has one from API response
}

export function FileThumbnail({
    fileId,
    mimeType,
    name,
    className = "h-10 w-10",
    iconClassName = "h-4 w-4",
    encryption,
    thumbnailPath,
}: FileThumbnailProps) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const getExtension = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];

    const ext = getExtension(name);
    const isImageExtension = imageExtensions.includes(ext);
    const isVideoExtension = videoExtensions.includes(ext);
    const isImage = mimeType?.startsWith("image/") || isImageExtension || mimeType?.startsWith("video/") || isVideoExtension;

    // Determine if we are SURE this is NOT a media file
    const isKnownNonMedia =
        (mimeType && !mimeType.startsWith("image/") && !mimeType.startsWith("video/")) ||
        (!mimeType && ext && !isImageExtension && !isVideoExtension);

    useEffect(() => {
        if (isKnownNonMedia) return;

        let isMounted = true;

        async function loadThumbnail() {
            // Check global cache first
            const cached = thumbnailCache.get(fileId);
            if (cached) {
                if (cached.timeout) {
                    clearTimeout(cached.timeout);
                    cached.timeout = undefined;
                }
                cached.refCount++;
                setThumbnailUrl(cached.url);
                return;
            }

            // If we've failed too many times, don't retry in this mount cycle
            if (hasError) return;

            setIsLoading(true);
            try {
                const response = await apiClient.getThumbnailUrl(fileId);

                if (!response.success || !response.data?.url) {
                    throw new Error("No thumbnail available");
                }

                const thumbResponse = await fetch(response.data.url);
                if (!thumbResponse.ok) throw new Error("Failed to download thumbnail");

                const encryptedText = await thumbResponse.text();
                const [encryptedPart, noncePart] = encryptedText.split(':');
                if (!encryptedPart || !noncePart) throw new Error("Invalid thumbnail format");

                let fileEncryption = encryption;

                const hasPQCKeys = fileEncryption &&
                    'kyberCiphertext' in fileEncryption &&
                    'nonceWrapKyber' in fileEncryption;

                if (!fileEncryption || !hasPQCKeys) {
                    // Fetch full file info to get complete encryption keys
                    const fileInfo = await apiClient.getFileInfo(fileId);

                    if (fileInfo.success && fileInfo.data?.encryption) {
                        fileEncryption = fileInfo.data.encryption as any;
                        // Double check keys in fetched info
                        if (!('kyberCiphertext' in (fileEncryption || {}))) {
                            // Fallback to getDownloadUrls which guarantees keys
                            const dlUrls = await apiClient.getDownloadUrls(fileId);
                            if (dlUrls.success && dlUrls.data?.encryption) {
                                fileEncryption = dlUrls.data.encryption as any;
                            }
                        }
                    } else {
                        const dlUrls = await apiClient.getDownloadUrls(fileId);
                        if (dlUrls.success && dlUrls.data?.encryption) {
                            fileEncryption = dlUrls.data.encryption as any;
                        }
                    }
                }

                if (!fileEncryption) throw new Error("Could not obtain encryption keys");

                const userKeys = await keyManager.getUserKeys();

                const cek = await unwrapCEK({
                    wrappedCek: fileEncryption.wrappedCek,
                    cekNonce: fileEncryption.cekNonce,
                    kyberCiphertext: fileEncryption.kyberCiphertext,
                    nonceWrapKyber: fileEncryption.nonceWrapKyber,
                    algorithm: 'v3-hybrid-pqc',
                    version: '3.0'
                } as DownloadEncryption, userKeys.keypairs);

                const decryptedBytes = decryptData(encryptedPart, cek, noncePart);
                const decryptedBlob = new Blob(
                    [decryptedBytes.buffer.slice(decryptedBytes.byteOffset, decryptedBytes.byteOffset + decryptedBytes.byteLength) as ArrayBuffer],
                    { type: 'image/jpeg' }
                );

                if (isMounted) {
                    const url = URL.createObjectURL(decryptedBlob);
                    console.log(`[FileThumbnail] Successfully decrypted thumbnail for ${fileId}`);

                    // Re-check cache to prevent race
                    const existing = thumbnailCache.get(fileId);
                    if (existing) {
                        if (existing.timeout) clearTimeout(existing.timeout);
                        existing.refCount++;
                        setThumbnailUrl(existing.url);
                    } else {
                        thumbnailCache.set(fileId, { url, refCount: 1 });
                        setThumbnailUrl(url);
                    }
                }
            } catch (err: any) {
                console.error(`[FileThumbnail] Error for ${fileId}:`, err);
                if (err?.message?.includes("invalid tag") || err?.message?.includes("MAC check failed")) {
                    console.error(`[FileThumbnail] Decryption failed for ${fileId}. This usually means incorrect keys or corrupted data.`);
                }
                if (retryCount < 2 && isMounted) {
                    setTimeout(() => setRetryCount(prev => prev + 1), 1000 * (retryCount + 1));
                } else if (isMounted) {
                    setHasError(true);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        loadThumbnail();

        return () => {
            isMounted = false;
            const entry = thumbnailCache.get(fileId);
            if (entry) {
                entry.refCount--;
                if (entry.refCount <= 0) {
                    // 10s retention
                    entry.timeout = setTimeout(() => {
                        const current = thumbnailCache.get(fileId);
                        if (current && current.refCount <= 0) {
                            URL.revokeObjectURL(current.url);
                            thumbnailCache.delete(fileId);
                        }
                    }, 10000);
                }
            }
        };
    }, [fileId, retryCount, hasError, encryption, mimeType, name, isKnownNonMedia]);

    if (isKnownNonMedia) {
        return <FileIcon mimeType={mimeType} filename={name} className={className} />;
    }

    // Render logic
    if (thumbnailUrl) {
        return (
            <div className={`relative overflow-hidden rounded-md ${className}`}>
                <img
                    src={thumbnailUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    draggable={false}
                />
            </div>
        );
    }

    if (isLoading && !hasError) {
        return (
            <div className={`flex items-center justify-center bg-muted rounded-md ${className}`}>
                <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
            </div>
        );
    }

    // Fallback
    return <FileIcon mimeType={mimeType} filename={name} className={className} />;
}
