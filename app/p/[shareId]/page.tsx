'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function PaperShareRedirect() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;

  useEffect(() => {
    if (!shareId) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    // Preserve fragment (CEK) when redirecting to /s/
    router.replace(`/s/${shareId}${hash}`);
  }, [shareId, router]);

  return null;
}
