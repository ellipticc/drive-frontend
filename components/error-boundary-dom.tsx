'use client';

import React, { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  recoveryKey: number;
}

/**
 * Error Boundary that handles DOM manipulation errors (insertBefore/removeChild NotFoundError).
 * 
 * These errors occur when React's virtual DOM is out of sync with the actual DOM,
 * typically caused by:
 *  - Browser extensions (Grammarly, password managers, translation tools) injecting/removing nodes
 *  - Third-party scripts modifying the DOM (analytics, session recording)
 *  - Loading overlay removal via document.getElementById().remove()
 *
 * Recovery strategy: Increment a key to force React to unmount and remount the entire
 * subtree with a clean DOM. This is the standard production pattern used by Meta/Vercel.
 * Limited to 3 recovery attempts to prevent infinite loops.
 */
export class DOMErrorBoundary extends Component<Props, State> {
  private recoveryAttempts = 0;
  private static MAX_RECOVERIES = 3;

  constructor(props: Props) {
    super(props);
    this.state = { recoveryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    const isDOMError =
      error.name === 'NotFoundError' ||
      error.message?.includes('insertBefore') ||
      error.message?.includes('removeChild') ||
      error.message?.includes('appendChild') ||
      error.message?.includes('not a child of this node');

    if (isDOMError) {
      // Return null — we handle recovery in componentDidCatch to track attempts
      return null;
    }

    // For non-DOM errors, don't handle — let them propagate
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isDOMError =
      error.name === 'NotFoundError' ||
      error.message?.includes('insertBefore') ||
      error.message?.includes('removeChild') ||
      error.message?.includes('appendChild') ||
      error.message?.includes('not a child of this node');

    if (isDOMError) {
      this.recoveryAttempts++;

      if (this.recoveryAttempts <= DOMErrorBoundary.MAX_RECOVERIES) {
        console.warn(
          `[DOMErrorBoundary] DOM desync detected (attempt ${this.recoveryAttempts}/${DOMErrorBoundary.MAX_RECOVERIES}). Forcing clean remount.`,
          error.message
        );
        // Force a clean remount by incrementing the key
        this.setState(prev => ({ recoveryKey: prev.recoveryKey + 1 }));
      } else {
        console.error(
          '[DOMErrorBoundary] Max recovery attempts reached. Reloading page.',
          error.message
        );
        // Last resort: full page reload
        window.location.reload();
      }
      return;
    }

    // Non-DOM errors: log and re-throw
    console.error('[DOMErrorBoundary] Non-DOM error:', error, errorInfo);
  }

  render() {
    return (
      <React.Fragment key={this.state.recoveryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
