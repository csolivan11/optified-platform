"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

/**
 * Root error boundary. Triggers for any uncaught error in a route segment
 * below it. Must be a client component because it receives the error and
 * reset props.
 *
 * In production, errors should also flow to an observability sink
 * (Sentry, Datadog, etc). The console.error here is the placeholder.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", error);
    // TODO (Phase 7+): pipe to Sentry or equivalent
    // captureException(error, { tags: { source: "app-error-boundary" } });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center">
          <AlertTriangle size={24} className="text-danger" strokeWidth={1.8} />
        </div>
        <div className="overline mb-3">Something went wrong</div>
        <h1 className="text-h1 mb-4">We hit an error</h1>
        <p className="text-body-lg text-muted-foreground leading-relaxed mb-8">
          Our team has been automatically notified. You can try again, or
          return to a known safe page.
        </p>
        {error.digest && (
          <p className="text-caption text-muted-foreground mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-success text-navy-900 font-semibold text-sm hover:bg-success/90 transition-colors"
          >
            <RefreshCcw size={14} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md border border-border text-foreground font-semibold text-sm hover:bg-card/60 transition-colors"
          >
            <Home size={14} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
