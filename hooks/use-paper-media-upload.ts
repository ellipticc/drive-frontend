import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { uploadEncryptedPaperAsset, UploadResult, UploadProgress } from '@/lib/upload';

export interface UploadedFile {
    id: string;
    url: string;
    name: string;
    size: number;
    type: string;
}

export function usePaperMediaUpload(paperId: string) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadingFile, setUploadingFile] = useState<File | undefined>(undefined);
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | undefined>(undefined);

    const uploadFile = useCallback(async (file: File) => {
        let activePaperId = paperId;

        // Fallback: If paperId is missing/undefined, try to grab it from URL (Robustness for existing papers)
        if ((!activePaperId || activePaperId === 'undefined') && typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            activePaperId = urlParams.get('fileId') as string;
        }

        if (!activePaperId || activePaperId === 'undefined') {
            toast.error("Please type some text to create the paper first.");
            setIsUploading(false);
            setUploadingFile(undefined);
            return;
        }

        setIsUploading(true);
        setUploadingFile(file);
        setProgress(0);

        try {
            const result: UploadResult = await uploadEncryptedPaperAsset(
                activePaperId,
                file,
                (p: UploadProgress) => {
                    setProgress(p.overallProgress);
                }
            );

            const blobUrl = URL.createObjectURL(file);

            const uploaded: UploadedFile = {
                id: (result.assetId || result.fileId || '') as string,
                url: blobUrl,
                name: file.name,
                size: file.size,
                type: file.type
            };

            setUploadedFile(uploaded);
            return uploaded;
        } catch (error) {
            console.error("Paper media upload failed:", error);
            const msg = error instanceof Error ? error.message : "Upload failed";
            toast.error(msg);
            throw error;
        } finally {
            setIsUploading(false);
            setUploadingFile(undefined);
        }
    }, [paperId]);

    return {
        isUploading,
        progress,
        uploadingFile,
        uploadedFile,
        uploadFile
    };
}
