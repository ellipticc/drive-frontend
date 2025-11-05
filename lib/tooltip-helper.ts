/**
 * Utility for conditional tooltip rendering
 * Shows tooltips only when text is truncated to avoid clutter
 */

export function shouldShowTooltip(originalText: string, truncatedText: string): boolean {
  // Show tooltip only if text was truncated (changed)
  return originalText !== truncatedText && originalText.length > 0;
}

/**
 * Determines if a text string will be truncated given a CSS max-width constraint
 * Returns true if tooltip should be shown (text is truncated)
 * 
 * This is a rough estimate - for precise measurement, use useRef in React component
 * @param text - The text to check
 * @param approximateMaxLength - Approximate character count before truncation (default: 30)
 * @returns true if tooltip should be shown
 */
export function isTextTruncated(text: string | undefined, approximateMaxLength: number = 30): boolean {
  if (!text) return false;
  return text.length > approximateMaxLength;
}
