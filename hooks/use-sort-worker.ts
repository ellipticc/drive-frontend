// Hook for using web worker to sort large datasets off main thread
import React, { useState, useCallback, useRef } from 'react';

interface SortOptions {
  sortBy: string;
  direction: 'asc' | 'desc';
  type: 'name' | 'date' | 'size' | 'type';
}

export function useSortWorker() {
  const [isSorting, setIsSorting] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('@/lib/workers/sort-worker.ts', import.meta.url));
    }
    return workerRef.current;
  }, []);

  const sortItems = useCallback(<T>(
    items: T[],
    options: SortOptions
  ): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      if (items.length < 100) {
        // For small arrays, sort synchronously for better performance
        const sorted = [...items].sort((a, b) => {
          let aVal: any, bVal: any;

          switch (options.type) {
            case 'name':
              aVal = (a as any).decryptedName || (a as any).name || '';
              bVal = (b as any).decryptedName || (b as any).name || '';
              break;
            case 'date':
              aVal = new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
              bVal = new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
              break;
            case 'size':
              aVal = parseInt((a as any).size) || 0;
              bVal = parseInt((b as any).size) || 0;
              break;
            case 'type':
              aVal = ((a as any).type || (a as any).mimeType || '').toLowerCase();
              bVal = ((b as any).type || (b as any).mimeType || '').toLowerCase();
              break;
            default:
              aVal = (a as any)[options.sortBy] || '';
              bVal = (b as any)[options.sortBy] || '';
          }

          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return options.direction === 'desc' ? -1 : 1;
          if (bVal == null) return options.direction === 'desc' ? 1 : -1;

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const comparison = aVal.localeCompare(bVal);
            return options.direction === 'desc' ? -comparison : comparison;
          }

          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return options.direction === 'desc' ? bVal - aVal : aVal - bVal;
          }

          const aStr = String(aVal);
          const bStr = String(bVal);
          const comparison = aStr.localeCompare(bStr);
          return options.direction === 'desc' ? -comparison : comparison;
        });

        resolve(sorted);
        return;
      }

      setIsSorting(true);
      const worker = getWorker();

      const handleMessage = (e: MessageEvent) => {
        worker.removeEventListener('message', handleMessage);
        setIsSorting(false);

        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.sortedItems);
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({
        items,
        ...options
      });
    });
  }, [getWorker]);

  // Cleanup worker on unmount
  React.useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return { sortItems, isSorting };
}