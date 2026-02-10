/**
 * useMessagePagination Hook
 * Manages scroll-based pagination for chat messages
 * Loads initial 50 messages, fetches older messages on scroll up
 */

import { useCallback, useState, useEffect, useRef } from 'react';

const PAGE_SIZE = 50;
const SCROLL_THRESHOLD = 500; // pixels from top

export interface PaginationState {
  messages: any[];
  isLoadingMore: boolean;
  hasMore: boolean;
  isInitialLoad: boolean;
  error: string | null;
}

export function useMessagePagination(
  conversationId: string | null,
  fetchMessages: (offset: number, limit: number) => Promise<any[]>,
  decryptHistory: (id: string) => Promise<any[]>
) {
  const [state, setState] = useState<PaginationState>({
    messages: [],
    isLoadingMore: false,
    hasMore: true,
    isInitialLoad: true,
    error: null,
  });

  const offsetRef = useRef(0);
  const hasLoadedInitialRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    if (!conversationId || hasLoadedInitialRef.current) return;

    const loadInitial = async () => {
      try {
        const messages = await decryptHistory(conversationId);
        // Load only the last PAGE_SIZE messages
        const recentMessages = messages.slice(-PAGE_SIZE);
        offsetRef.current = Math.max(0, messages.length - PAGE_SIZE);

        setState(prev => ({
          ...prev,
          messages: recentMessages,
          isInitialLoad: false,
          hasMore: offsetRef.current > 0,
        }));

        hasLoadedInitialRef.current = true;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load messages',
          isInitialLoad: false,
        }));
      }
    };

    loadInitial();
  }, [conversationId, decryptHistory]);

  // Scroll-based pagination
  const handleScroll = useCallback(async () => {
    if (!containerRef.current || state.isLoadingMore || !state.hasMore) return;

    const { scrollTop } = containerRef.current;

    if (scrollTop < SCROLL_THRESHOLD) {
      setState(prev => ({ ...prev, isLoadingMore: true }));

      try {
        const olderMessages = await fetchMessages(offsetRef.current - PAGE_SIZE, PAGE_SIZE);

        if (olderMessages.length < PAGE_SIZE) {
          setState(prev => ({ ...prev, hasMore: false }));
        }

        offsetRef.current = Math.max(0, offsetRef.current - PAGE_SIZE);

        setState(prev => ({
          ...prev,
          messages: [...olderMessages, ...prev.messages],
          isLoadingMore: false,
        }));

        // Maintain scroll position
        if (containerRef.current) {
          const scrollHeight = containerRef.current.scrollHeight;
          containerRef.current.scrollTop = scrollHeight - (containerRef.current.clientHeight - SCROLL_THRESHOLD);
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load messages',
          isLoadingMore: false,
        }));
      }
    }
  }, [fetchMessages, state.isLoadingMore, state.hasMore]);

  // Add new message to the end
  const addMessage = useCallback((message: any) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }, []);

  // Update existing message (for streaming)
  const updateMessage = useCallback((messageId: string, updates: Partial<any>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === messageId ? { ...m, ...updates } : m
      ),
    }));
  }, []);

  return {
    ...state,
    containerRef,
    handleScroll,
    addMessage,
    updateMessage,
  };
}
