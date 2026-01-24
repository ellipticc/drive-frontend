import { useState, useEffect } from 'react';
import { downloadEncryptedPaperAsset } from '@/lib/download';

interface MediaUrlState {
    url: string | null;
    loading: boolean;
    error: string | null;
}

export function useMediaUrl(paperId: string, fileId?: string, initialUrl?: string) {
    const [state, setState] = useState<MediaUrlState>({
        url: initialUrl || null,
        loading: false,
        error: null
    });

    const createdUrls = useState<Set<string>>(() => new Set())[0];

    useEffect(() => {
        // If we don't have a fileId (asset ID) OR a paperId, we can't download from backend.
        // Fallback to initialUrl if available.
        if (!fileId || !paperId) {
            if (initialUrl) {
                setState({ url: initialUrl, loading: false, error: null });
            }
            return;
        }

        let isMounted = true;
        const abortController = new AbortController();

        const loadMedia = async () => {
            setState(prev => ({ ...prev, loading: true, error: null }));
            try {
                const result = await downloadEncryptedPaperAsset(
                    paperId,
                    fileId,
                    undefined,
                    abortController.signal
                );

                if (isMounted) {
                    const blobUrl = URL.createObjectURL(result.blob);
                    createdUrls.add(blobUrl);
                    setState({ url: blobUrl, loading: false, error: null });
                }
            } catch (err: any) {
                if (isMounted) {
                    // If abort error, ignore
                    if ((err instanceof Error && err.name === 'AbortError') || (typeof err === 'object' && err?.name === 'AbortError')) return;

                    console.error(`Failed to load media ${fileId}`, err);

                    if (initialUrl) {
                        setState({ url: initialUrl, loading: false, error: null });
                    } else {
                        setState({ url: null, loading: false, error: 'Failed to load media' });
                    }
                }
            }
        };

        loadMedia();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, [paperId, fileId, initialUrl, createdUrls]);

    // Cleanup effect for created blob URLs when component unmounts
    useEffect(() => {
        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
            createdUrls.clear();
        };
    }, [createdUrls]);

    return state;
}
