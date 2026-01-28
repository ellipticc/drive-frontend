'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PaperShareRedirectContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const shareId = searchParams.get('shareId');

    useEffect(() => {
        if (!shareId) return;
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        // Preserve fragment (CEK) when redirecting to /s/
        router.replace(`/s?shareId=${shareId}${hash}`);
    }, [shareId, router]);

    return null;
}

export default function PaperShareRedirect() {
    return (
        <Suspense fallback={null}>
            <PaperShareRedirectContent />
        </Suspense>
    );
}
