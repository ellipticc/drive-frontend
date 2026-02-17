/**
 * Utilities for calculating and managing context window usage
 */

export interface ContextUsage {
  systemTokens: number;
  toolDefinitionTokens: number;
  messageTokens: number;
  toolResultTokens: number;
  totalUsed: number;
}

/**
 * Rough token estimation: 1 token ≈ 4 characters
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from text
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Calculate context usage from messages and system prompt
 * @param messages - Array of chat messages with role and content
 * @param systemPrompt - System prompt text
 * @param toolDefinitions - Tool definition text
 * @param maxTokens - Maximum context window size
 * @returns Context usage breakdown
 */
export function calculateContextUsage(
  messages: Array<{ role: string; content: string }> = [],
  systemPrompt: string = "",
  toolDefinitions: string = "",
  maxTokens: number = 128000
): ContextUsage & { percentage: number; maxTokens: number } {
  // Calculate tokens for each component
  const systemTokens = estimateTokensFromText(systemPrompt);
  const toolDefinitionTokens = estimateTokensFromText(toolDefinitions);

  // Separate message tokens into user/assistant
  let userMessageTokens = 0;
  let toolResultTokens = 0;

  messages.forEach((msg) => {
    const tokens = estimateTokensFromText(msg.content);
    if (msg.role === "tool") {
      toolResultTokens += tokens;
    } else {
      userMessageTokens += tokens;
    }
  });

  const totalUsed =
    systemTokens +
    toolDefinitionTokens +
    userMessageTokens +
    toolResultTokens;

  const percentage = maxTokens > 0 ? (totalUsed / maxTokens) * 100 : 0;

  return {
    systemTokens,
    toolDefinitionTokens,
    messageTokens: userMessageTokens,
    toolResultTokens,
    totalUsed,
    percentage,
    maxTokens,
  };
}

/**
 * Format context usage for display
 */
export function formatContextUsage(
  usage: ContextUsage & { percentage: number }
): string {
  const percent = usage.percentage.toFixed(1);
  return `${percent}% of context`;
}

/**
 * Check if context usage is approaching limit (85%+)
 */
export function isContextNearLimit(
  usedTokens: number,
  maxTokens: number,
  threshold: number = 0.85
): boolean {
  return usedTokens / maxTokens >= threshold;
}
