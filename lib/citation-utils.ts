/**
 * Utility functions for handling citations in markdown content
 */

/**
 * Extracts all citation indices from content
 * Supports both [1] and 【1】 formats
 */
export function extractCitationIndices(content: string): number[] {
    if (!content) return [];
    
    // Match both [N] and 【N】 formats
    const citationRegex = /(?:\[(\d+)\]|【(\d+)】)/g;
    const indices = new Set<number>();
    
    let match;
    while ((match = citationRegex.exec(content)) !== null) {
        // Group 1 is standard [N], group 2 is full-width 【N】
        const index = parseInt(match[1] || match[2], 10);
        indices.add(index);
    }
    
    return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Normalizes citations in content to standard [N] format
 * Converts 【N】 to [N] for consistency
 */
export function normalizeCitations(content: string): string {
    if (!content) return content;
    
    // Replace full-width citations 【N】 with standard [N]
    return content.replace(/【(\d+)】/g, '[$1]');
}

/**
 * Extracts citations that are actually referenced in the content
 * Returns an array of source objects filtered to only those cited
 */
export function getReferencedSources(
    content: string,
    allSources: Array<{ title: string; url: string; content?: string }>
): Array<{ title: string; url: string; content?: string; citationIndex: number }> {
    const citedIndices = extractCitationIndices(content);
    
    return citedIndices
        .map(index => {
            const source = allSources[index - 1]; // Convert 1-indexed to 0-indexed
            if (source) {
                return { ...source, citationIndex: index };
            }
            return null;
        })
        .filter((s): s is any => s !== null);
}

/**
 * Validates that all citations in content have corresponding sources
 */
export function validateCitations(
    content: string,
    sources: Array<{ title: string; url: string; content?: string }>
): { valid: boolean; missingIndices: number[] } {
    const citedIndices = extractCitationIndices(content);
    const missingIndices = citedIndices.filter(index => index > sources.length || index < 1);
    
    return {
        valid: missingIndices.length === 0,
        missingIndices
    };
}

/**
 * Strips all citations from content for plain text display
 */
export function stripCitations(content: string): string {
    if (!content) return content;
    
    return content.replace(/(?:\[\d+\]|【\d+】)/g, '');
}
