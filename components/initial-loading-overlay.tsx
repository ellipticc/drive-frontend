'use client';

import { useEffect, useState } from 'react';

// InitialLoadingOverlay — React-controlled loading screen.

export function InitialLoadingOverlay() {
  // Start mounted (visible). SSR and initial client render both produce the overlay,
  // so hydration is perfectly consistent. useEffect then wires up the hide listener.
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const hide = () => {
      setFading(true);
      // After the CSS transition (500ms), unmount entirely so React's tree is clean
      setTimeout(() => setVisible(false), 500);
    };

    window.addEventListener('ecc:overlay:hide', hide);
    return () => window.removeEventListener('ecc:overlay:hide', hide);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        zIndex: 9999,
        transition: 'opacity 0.5s ease-in-out',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <svg
          className="h-8 w-8 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }} className="text-muted-foreground">
          Loading…
        </p>
      </div>
    </div>
  );
}
