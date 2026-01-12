import { useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { useUser } from '@/components/user-context';

export function useFormatter() {
    const { user } = useUser();

    const formatDate = useCallback((date: string | number | Date | null | undefined): string => {
        if (!date) return '';

        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';

        // Default formats
        let datePart = 'MM/dd/yyyy';
        let timePart = 'hh:mm a';

        // Apply user preferences
        if (user?.date_format) {
            switch (user.date_format) {
                case 'DD/MM/YYYY':
                    datePart = 'dd/MM/yyyy';
                    break;
                case 'YYYY-MM-DD':
                    datePart = 'yyyy-MM-dd';
                    break;
                case 'MMM D, YYYY':
                    datePart = 'MMM d, yyyy';
                    break;
                case 'MM/DD/YYYY':
                default:
                    datePart = 'MM/dd/yyyy';
                    break;
            }
        }

        if (user?.time_format === '24h') {
            timePart = 'HH:mm';
        } else {
            timePart = 'hh:mm a';
        }

        return formatDateFns(dateObj, `${datePart} ${timePart}`);
    }, [user?.date_format, user?.time_format]);

    return { formatDate };
}
