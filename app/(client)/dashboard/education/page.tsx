import { PageHeader } from "@/components/layout/page-header";
import { ArticleCard, type ArticleCardData } from "@/components/domain/article-card";
import { requireClientContext } from "@/lib/supabase/auth";
import { educationRepo } from "@/lib/repositories";

interface PageProps {
  searchParams: { category?: string };
}

export default async function EducationPage({ searchParams }: PageProps) {
  const ctx = await requireClientContext();
  const activeCategory = searchParams.category;

  const [assigned, library, categories] = await Promise.all([
    educationRepo.listAssignedForClient(ctx.effectiveClientId, 6),
    educationRepo.listLibrary(activeCategory, 30),
    educationRepo.listCategories(),
  ]);

  const personalized: ArticleCardData[] = assigned.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    read_time_min: a.read_time_min,
    reason: a.assignment_reason,
    unread: a.read_at === null,
  }));

  // Filter library to exclude already-personalized articles to avoid duplication
  const personalizedSlugs = new Set(personalized.map((p) => p.slug));
  const libraryFiltered = library.filter((a) => !personalizedSlugs.has(a.slug));

  return (
    <>
      <PageHeader
        eyebrow="Personalized Learning"
        title="Education"
        description="Content curated to your biomarkers and protocol. Evidence-based, never sponsored."
      />

      {/* ─── For You ───────────────────────────────────────── */}
      {personalized.length > 0 && (
        <section className="mb-12 animate-fade-in">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-h3">For you</h2>
            <span className="text-caption text-muted-foreground">
              Based on your data and protocol
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personalized.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                variant="featured"
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Library ───────────────────────────────────────── */}
      <section className="animate-fade-in">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-h3">Library</h2>
          <span className="text-caption text-muted-foreground">
            {libraryFiltered.length}{" "}
            {libraryFiltered.length === 1 ? "article" : "articles"}
          </span>
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <CategoryPill
              label="All"
              active={!activeCategory}
              href="/dashboard/education"
            />
            {categories.map((cat) => (
              <CategoryPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                href={`/dashboard/education?category=${encodeURIComponent(cat)}`}
              />
            ))}
          </div>
        )}

        {libraryFiltered.length === 0 ? (
          <p className="text-body text-muted-foreground py-8 text-center">
            No articles in this category yet.
          </p>
        ) : (
          <div className="space-y-3">
            {libraryFiltered.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                variant="compact"
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CategoryPill({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      className={
        active
          ? "px-3 py-1.5 rounded-md text-caption font-semibold bg-success/15 text-success border border-success/30"
          : "px-3 py-1.5 rounded-md text-caption font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:border-navy-400 transition-colors"
      }
    >
      {label}
    </a>
  );
}
