'use client';

import React, { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorCount: number;
}

/**
 * Error Boundary that specifically handles DOM manipulation errors from third-party scripts.
 * These errors typically occur during navigation when libraries like KaTeX or RRWeb
 * try to manipulate DOM nodes that React is also managing.
 */
export class DOMErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    const isDOMError = 
      error.message?.includes('insertBefore') ||
      error.message?.includes('removeChild') ||
      error.message?.includes('appendChild') ||
      error.message?.includes('Failed to execute');

    if (isDOMError) {
      // Log the DOM error for debugging but don't break the app
      console.warn('[DOMErrorBoundary] DOM manipulation error during navigation:', error.message);
      return { hasError: false, errorCount: 0 }; // Don't treat as fatal
    }

    return { hasError: true, errorCount: 1 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isDOMError = 
      error.message?.includes('insertBefore') ||
      error.message?.includes('removeChild') ||
      error.message?.includes('appendChild') ||
      error.message?.includes('Failed to execute');

    if (!isDOMError) {
      console.error('[DOMErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px' }}>
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
