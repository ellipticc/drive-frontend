// Web worker for expensive sorting operations
// Offloads sorting from main thread to prevent UI blocking

export interface SortMessage {
  items: any[];
  sortBy: string;
  direction: 'asc' | 'desc';
  type: 'name' | 'date' | 'size' | 'type';
}

export interface SortResult {
  sortedItems: any[];
  sortTime: number;
}

self.onmessage = (e: MessageEvent<SortMessage>) => {
  const startTime = performance.now();
  const { items, sortBy, direction, type } = e.data;

  try {
    const sorted = [...items].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (type) {
        case 'name':
          aVal = (a.decryptedName || a.name || '').toLowerCase();
          bVal = (b.decryptedName || b.name || '').toLowerCase();
          break;
        case 'date':
          aVal = new Date(a.updatedAt || a.createdAt || 0).getTime();
          bVal = new Date(b.updatedAt || b.createdAt || 0).getTime();
          break;
        case 'size':
          aVal = parseInt(a.size) || 0;
          bVal = parseInt(b.size) || 0;
          break;
        case 'type':
          aVal = (a.type || a.mimeType || '').toLowerCase();
          bVal = (b.type || b.mimeType || '').toLowerCase();
          break;
        default:
          aVal = a[sortBy] || '';
          bVal = b[sortBy] || '';
      }

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === 'desc' ? -1 : 1;
      if (bVal == null) return direction === 'desc' ? 1 : -1;

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return direction === 'desc' ? -comparison : comparison;
      }

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'desc' ? bVal - aVal : aVal - bVal;
      }

      // Fallback string comparison
      const aStr = String(aVal);
      const bStr = String(bVal);
      const comparison = aStr.localeCompare(bStr);
      return direction === 'desc' ? -comparison : comparison;
    });

    const endTime = performance.now();
    const result: SortResult = {
      sortedItems: sorted,
      sortTime: endTime - startTime
    };

    self.postMessage(result);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};