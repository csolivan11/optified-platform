/**
 * Root-level loading state shown while a route segment streams in.
 * Intentionally minimal — just a subtle brand spinner.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-border border-t-success rounded-full animate-spin" />
        <span className="overline text-muted-foreground">Loading</span>
      </div>
    </div>
  );
}
