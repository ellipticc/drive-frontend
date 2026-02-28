"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground font-sans p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground text-lg">
            An unexpected error occurred. We've been notified and are looking into it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}