import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/domain/markdown";
import { requireClientContext } from "@/lib/supabase/auth";
import { educationRepo } from "@/lib/repositories";

interface PageProps {
  params: { slug: string };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const ctx = await requireClientContext();
  const article = await educationRepo.findBySlug(params.slug);

  if (!article) {
    notFound();
  }

  // Fire and forget — mark as read in the background. Skip during
  // impersonation: an admin viewing-as-client should not pollute the
  // client's read history.
  if (!ctx.isImpersonating) {
    educationRepo.markRead(ctx.effectiveClientId, article.id).catch((err) => {
      console.warn("[education detail] markRead failed", err);
    });
  }

  return (
    <article className="max-w-2xl mx-auto animate-fade-in">
      <Link
        href="/dashboard/education"
        className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Education
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          {article.category && <Badge variant="info">{article.category}</Badge>}
          {article.read_time_min && (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
              <Clock size={12} />
              {article.read_time_min} min read
            </span>
          )}
        </div>
        <h1 className="text-h1 mb-3">{article.title}</h1>
        {article.excerpt && (
          <p className="text-body-lg text-muted-foreground leading-relaxed">
            {article.excerpt}
          </p>
        )}
      </header>

      <Card>
        <CardContent className="p-10">
          <Markdown source={article.body} className="space-y-1" />
        </CardContent>
      </Card>

      <footer className="mt-8 text-center text-caption text-muted-foreground">
        Optified Medical · No affiliate links, no product placements,
        no financial incentive behind anything written here.
      </footer>
    </article>
  );
}
