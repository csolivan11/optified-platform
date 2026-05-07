import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ArticleEditor } from "../article-editor";
import { requireRole } from "@/lib/supabase/auth";
import { educationRepo } from "@/lib/repositories";

interface PageProps {
  params: { id: string };
  searchParams: { flash?: string };
}

export default async function EditArticlePage({
  params,
  searchParams,
}: PageProps) {
  await requireRole("admin");

  const article = await educationRepo.findByIdForAdmin(params.id);
  if (!article) notFound();

  const justCreated = searchParams.flash === "created";

  return (
    <>
      <Link
        href="/admin/education"
        className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to articles
      </Link>

      <PageHeader
        eyebrow="Education"
        title="Edit article"
        description="Changes propagate to clients on save. Toggle published off to unpublish without deleting."
      >
        {article.published ? (
          <Link
            href={`/dashboard/education/${article.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold text-info border border-info/30 hover:bg-info/10 transition-colors"
          >
            <ExternalLink size={12} />
            View live
          </Link>
        ) : (
          <Badge variant="default">Draft — not yet visible to clients</Badge>
        )}
      </PageHeader>

      {justCreated && (
        <div className="mb-6 p-4 rounded-md bg-success/10 border border-success/30 inline-flex items-center gap-2 text-success">
          <CheckCircle2 size={14} />
          <span className="text-caption font-semibold">
            Article created. You can keep editing or share the URL with the team.
          </span>
        </div>
      )}

      <ArticleEditor
        mode="edit"
        initial={{
          id: article.id,
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          body: article.body,
          category: article.category,
          read_time_min: article.read_time_min,
          published: article.published,
        }}
      />
    </>
  );
}
