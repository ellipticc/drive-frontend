/**
 * Deep Thinking Chain Parser
 * Handles parsing of structured thinking content with tags like:
 * - <think> or <thinking>: Meta-level reasoning
 * - <search>: Information gathering steps
 * - <code>: Code analysis or generation
 * - <analyze>: Analysis steps
 * - <plan>: Planning steps
 */

export interface ThinkingStep {
  type: 'think' | 'thinking' | 'search' | 'code' | 'analyze' | 'plan' | 'unknown';
  content: string;
  startIndex: number;
  endIndex: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ThinkingChain {
  steps: ThinkingStep[];
  totalDuration?: number;
  tokenCount: number;
  rawContent: string;
}

/**
 * Parse thinking content into structured steps
 */
export function parseThinkingChain(content: string): ThinkingChain {
  const steps: ThinkingStep[] = [];
  const tagNames = ['think', 'thinking', 'search', 'code', 'analyze', 'plan'];
  
  let currentIndex = 0;
  const regex = new RegExp(`<(${tagNames.join('|')})>([\\s\\S]*?</\\1>`, 'g');
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const type = match[1] as ThinkingStep['type'];
    const stepContent = match[2];
    
    steps.push({
      type,
      content: stepContent.trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  const tokenCount = content.split(/\s+/).filter(t => t.length > 0).length;

  return {
    steps,
    tokenCount,
    rawContent: content,
  };
}

/**
 * Extract raw thinking content removing all tags
 */
export function extractThinkingContent(content: string): string {
  const tagNames = ['think', 'thinking', 'search', 'code', 'analyze', 'plan'];
  const regex = new RegExp(`</?(?:${tagNames.join('|')})[^>]*>`, 'g');
  return content.replace(regex, '').trim();
}

/**
 * Get statistics about a thinking chain
 */
export function getThinkingStats(chain: ThinkingChain) {
  const typeCount = chain.steps.reduce((acc, step) => {
    acc[step.type] = (acc[step.type] || 0) + 1;
    return acc;
  }, {} as Record<ThinkingStep['type'], number>);

  const mostFrequentType = Object.entries(typeCount).sort(([, a], [, b]) => b - a)[0];

  return {
    totalSteps: chain.steps.length,
    typeCount,
    tokenCount: chain.tokenCount,
    averageStepLength: chain.steps.length > 0 
      ? Math.round(chain.steps.reduce((acc, s) => acc + s.content.length, 0) / chain.steps.length)
      : 0,
    mostFrequentType: mostFrequentType?.[0],
    mostFrequentTypeCount: mostFrequentType?.[1] || 0,
  };
}

/**
 * Get icon for a thinking step type
 */
export const getThinkingStepIcon = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'think':
    case 'thinking':
      return 'IconBulb'; 
    case 'search':
      return 'IconWorld'; 
    case 'code':
      return 'IconCode';
    case 'analyze':
      return 'IconChart'; 
    case 'plan':
      return 'IconList'; 
    default:
      return '•';
  }
};

/**
 * Get label for a thinking step type
 */
export const getThinkingStepLabel = (type: ThinkingStep['type']): string => {
  switch (type) {
    case 'think':
      return 'Thinking';
    case 'thinking':
      return 'Deep Thinking';
    case 'search':
      return 'Search';
    case 'code':
      return 'Code Analysis';
    case 'analyze':
      return 'Analysis';
    case 'plan':
      return 'Planning';
    default:
      return 'Unknown';
  }
};

/**
 * Format thinking step for display
 */
export function formatThinkingStep(step: ThinkingStep): string {
  return `${getThinkingStepLabel(step.type)}: ${step.content.substring(0, 100)}${step.content.length > 100 ? '...' : ''}`;
}
