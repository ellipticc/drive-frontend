"use client"

import { useState, useEffect } from 'react';
import { formatRelativeTime } from '@/lib/utils';

/**
 * React hook that returns a formatted relative time string and updates regularly.
 */
export function useRelativeTime(dateInput: string | Date | number): string {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return formatRelativeTime(dateInput);
}
