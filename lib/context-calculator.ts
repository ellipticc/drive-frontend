/**
 * Context Calculator - Calculates token usage by model
 * Supports dynamic context window sizing based on model selection
 */

export interface ContextBreakdown {
  systemTokens: number;
  toolDefinitionTokens: number;
  messageTokens: number; // total messages (user + assistant)
  userMessageTokens: number; // tokens from user messages
  assistantMessageTokens: number; // tokens from assistant messages
  toolResultTokens: number;
  totalUsed: number;
  percentage: number;
  maxTokens: number;
  model: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any[];
  parent_id?: string | null;
}

// Model context window sizes (from provider specifications)
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'llama-3.3-70b-versatile': 131072,
  'openai/gpt-oss-120b': 131072,
  'qwen/qwen3-32b': 131072,
  'moonshotai/kimi-k2-instruct-0905': 262144,
};

/**
 * Estimate tokens from text - conservative estimate
 * ~1 token ≈ 4 characters for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Get context window for a model
 */
export function getContextWindow(model: string): number {
  return MODEL_CONTEXT_WINDOWS[model] || 131072; // Default to 131k
}

/**
 * Smart context trimming - VS Code approach
 * Token-counts each message and dynamically removes old messages when approaching ~85% threshold
 * Preserves most recent messages (recency > history), model-aware
 */
export function trimHistoryByTokens(
  messages: Message[],
  model: string,
  currentUserMessage: string,
  systemPrompt?: string,
  maxReserveTokens: number = 25000, // Reserve for response generation
): Message[] {
  if (!messages.length) return [];

  const contextWindow = getContextWindow(model);
  const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 420;

  // Calculate budget: 85% of window minus system prompt and reserves
  const threshold = contextWindow * 0.85;
  const budget = threshold - systemTokens - maxReserveTokens - estimateTokens(currentUserMessage);

  let totalTokens = 0;
  const trimmed: Message[] = [];

  // Add messages from most recent backwards until hitting budget
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);

    // Stop if adding this message would exceed budget
    if (totalTokens + msgTokens > budget) {
      break;
    }

    trimmed.unshift(messages[i]);
    totalTokens += msgTokens;
  }

  return trimmed;
}

/**
 * Calculate full context breakdown from messages, system prompt, and tools
 */
export function calculateContextBreakdown(
  messages: Message[],
  model: string = 'llama-3.3-70b-versatile',
  systemPrompt?: string,
  tools?: any[],
): ContextBreakdown {
  const maxTokens = getContextWindow(model);

  // 1. System prompt tokens (typically ~200-500 tokens for standard system prompts)
  const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 420;

  // 2. Tool definitions tokens (if tools are provided)
  const toolDefinitionTokens = tools && tools.length > 0
    ? estimateTokens(JSON.stringify(tools))
    : 0;

  // 3. Message tokens (from conversation history) - split by role
  let messageTokens = 0;
  let userMessageTokens = 0;
  let assistantMessageTokens = 0;

  for (const msg of messages) {
    const t = estimateTokens(msg.content);
    messageTokens += t;
    if (msg.role === 'user') userMessageTokens += t;
    else if (msg.role === 'assistant') assistantMessageTokens += t;
  }

  // 4. Tool results tokens (estimate from any tool calls)
  const toolResultTokens = messages.reduce((total, msg) => {
    if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
      const toolOutput = msg.toolCalls.reduce((sum, call) => {
        return sum + estimateTokens(JSON.stringify(call));
      }, 0);
      return total + toolOutput;
    }
    return total;
  }, 0);

  const totalUsed = systemTokens + toolDefinitionTokens + messageTokens + toolResultTokens;
  const percentage = (totalUsed / maxTokens) * 100;

  return {
    systemTokens,
    toolDefinitionTokens,
    messageTokens,
    userMessageTokens,
    assistantMessageTokens,
    toolResultTokens,
    totalUsed,
    percentage: Math.min(percentage, 100),
    maxTokens,
    model,
  };
}

/**
 * Check if context is near limit (85% threshold)
 */
export function isContextNearLimit(breakdown: ContextBreakdown): boolean {
  return breakdown.percentage >= 85;
}

/**
 * Get human-readable token count with units
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}

/**
 * Get context usage as percentage display
 */
export function getContextPercentage(breakdown: ContextBreakdown): string {
  return `${breakdown.percentage.toFixed(1)}%`;
}
