import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-card border border-border flex items-center justify-center">
          <Compass size={24} className="text-muted-foreground" strokeWidth={1.8} />
        </div>
        <div className="overline mb-3">Error 404</div>
        <h1 className="text-h1 mb-4">Page not found</h1>
        <p className="text-body-lg text-muted-foreground leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          If you arrived here from a link inside the app, please let us know
          so we can fix it.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-success text-navy-900 font-semibold text-sm hover:bg-success/90 transition-colors"
          >
            <ArrowLeft size={14} />
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
