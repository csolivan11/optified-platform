import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ArticleEditor } from "../article-editor";
import { requireRole } from "@/lib/supabase/auth";

export default async function NewArticlePage() {
  await requireRole("admin");

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
        title="New article"
        description="Compose in markdown. Toggle to preview to see exactly how it renders to clients."
      />
      <ArticleEditor mode="create" />
    </>
  );
}
