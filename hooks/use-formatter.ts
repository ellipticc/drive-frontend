import { useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { useUser } from '@/components/user-context';

export function useFormatter() {
    const { user } = useUser();

    const getDateFormat = useCallback(() => {
        if (!user?.date_format) return 'MM/dd/yyyy';
        switch (user.date_format) {
            case 'DD/MM/YYYY':
                return 'dd/MM/yyyy';
            case 'YYYY-MM-DD':
                return 'yyyy-MM-dd';
            case 'MMM D, YYYY':
                return 'MMM d, yyyy';
            case 'MM/DD/YYYY':
            default:
                return 'MM/dd/yyyy';
        }
    }, [user?.date_format]);

    const getTimeFormat = useCallback(() => {
        return user?.time_format === '24h' ? 'HH:mm' : 'hh:mm a';
    }, [user?.time_format]);

    const formatDateTime = useCallback((date: string | number | Date | null | undefined): string => {
        if (!date) return '';
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        return formatDateFns(dateObj, `${getDateFormat()} ${getTimeFormat()}`);
    }, [getDateFormat, getTimeFormat]);

    const formatDateOnly = useCallback((date: string | number | Date | null | undefined): string => {
        if (!date) return '';
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        return formatDateFns(dateObj, getDateFormat());
    }, [getDateFormat]);

    const formatTimeOnly = useCallback((date: string | number | Date | null | undefined): string => {
        if (!date) return '';
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        return formatDateFns(dateObj, getTimeFormat());
    }, [getTimeFormat]);

    return {
        formatDate: formatDateTime, // Alias for backward compatibility
        formatDateTime,
        formatDateOnly,
        formatTimeOnly
    };
}
