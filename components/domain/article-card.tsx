import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

export interface ArticleCardData {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  read_time_min: number | null;
  // Optional personalization fields
  reason?: string | null;
  unread?: boolean;
}

interface Props {
  article: ArticleCardData;
  variant?: "featured" | "compact";
  className?: string;
}

/**
 * Two visual modes:
 *   featured — large card used in the "For You" personalized section
 *   compact  — single-row entry used in the browseable library
 */
export function ArticleCard({ article, variant = "compact", className }: Props) {
  const href = `/dashboard/education/${article.slug}`;

  if (variant === "featured") {
    return (
      <Link
        href={href}
        className={cn(
          "group block rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:shadow-elevation-2 hover:border-navy-400",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          {article.reason && (
            <Badge variant="accent" className="font-semibold">
              Personalized
            </Badge>
          )}
          {article.category && (
            <span className="overline">{article.category}</span>
          )}
          {article.unread && (
            <span className="ml-auto w-2 h-2 rounded-full bg-success" aria-label="Unread" />
          )}
        </div>
        <h3 className="text-h3 font-bold mb-2 text-foreground group-hover:text-foreground/90 transition-colors">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-body text-muted-foreground leading-relaxed mb-3 line-clamp-2">
            {article.excerpt}
          </p>
        )}
        {article.reason && (
          <p className="text-caption text-accent/90 italic mb-3">
            {article.reason}
          </p>
        )}
        <div className="flex items-center gap-3 text-caption text-muted-foreground">
          {article.read_time_min && (
            <span className="inline-flex items-center gap-1.5">
              <Clock size={11} /> {article.read_time_min} min read
            </span>
          )}
        </div>
      </Link>
    );
  }

  // compact
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between gap-4 px-6 py-4 rounded-lg border border-border bg-card hover:border-navy-400 hover:shadow-elevation-1 transition-all",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold truncate group-hover:text-foreground">
          {article.title}
        </div>
        <div className="text-caption text-muted-foreground mt-0.5 flex items-center gap-2">
          {article.category && <span>{article.category}</span>}
          {article.category && article.read_time_min && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {article.read_time_min && (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {article.read_time_min} min
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={16}
        className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors"
      />
    </Link>
  );
}
