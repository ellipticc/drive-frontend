/**
 * Prompt input and token limits
 * Shared constants between client and backend for consistent validation
 */

/**
 * Maximum tokens allowed in a single prompt
 * Based on typical token limits for LLM context windows
 */
export const MAX_INPUT_TOKENS = 8000;

/**
 * Maximum characters allowed (rough estimate: 1 char ≈ 0.25 tokens)
 * This is a safeguard for extreme cases
 */
export const MAX_INPUT_CHARS = 32000;

/**
 * Maximum height for textarea in pixels before scrolling takes over
 */
export const MAX_INPUT_HEIGHT_PX = 240;

/**
 * Token estimation ratio: characters per token
 * Used for client-side estimation (1 token ≈ 4 characters on average)
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Warning threshold: show warning when approaching limit (as a percentage)
 */
export const TOKEN_LIMIT_WARNING_THRESHOLD = 0.85; // 85% of limit

/**
 * Estimate token count from text
 * @param text - Input text to estimate token count
 * @returns Estimated number of tokens
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters
  // This is conservative to account for actual tokenization overhead
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check if a prompt exceeds the token limit
 * @param text - Input text to check
 * @returns true if prompt exceeds limit
 */
export function isPromptTooLong(text: string): boolean {
  return estimateTokens(text) > MAX_INPUT_TOKENS;
}

/**
 * Check if a prompt is approaching the warning threshold
 * @param text - Input text to check
 * @returns true if prompt is in warning zone
 */
export function isPromptApproachingLimit(text: string): boolean {
  const tokens = estimateTokens(text);
  const threshold = Math.floor(MAX_INPUT_TOKENS * TOKEN_LIMIT_WARNING_THRESHOLD);
  return tokens > threshold && tokens <= MAX_INPUT_TOKENS;
}

/**
 * Get remaining tokens available
 * @param text - Current input text
 * @returns Number of tokens remaining before limit
 */
export function getRemainingTokens(text: string): number {
  const used = estimateTokens(text);
  return Math.max(0, MAX_INPUT_TOKENS - used);
}

/**
 * Format token count for display
 * @param tokens - Number of tokens
 * @returns Formatted string for UI
 */
export function formatTokenCount(tokens: number): string {
  return `${tokens.toLocaleString()} tokens`;
}
