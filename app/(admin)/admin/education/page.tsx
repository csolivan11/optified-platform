import Link from "next/link";
import { Plus, FileText, Eye, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { educationRepo } from "@/lib/repositories";
import { requireRole } from "@/lib/supabase/auth";

export default async function EducationAdminPage() {
  await requireRole("admin");
  const articles = await educationRepo.listForAdmin();

  const published = articles.filter((a) => a.published);
  const drafts = articles.filter((a) => !a.published);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Education"
        description="Author articles for the personalized education library. No affiliate links, no product placements — evidence-based only."
      >
        <Button asChild size="sm">
          <Link href="/admin/education/new">
            <Plus size={14} />
            New article
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total articles" value={articles.length} icon={FileText} />
        <StatCard label="Published" value={published.length} icon={BookOpen} tone="success" />
        <StatCard label="Drafts" value={drafts.length} icon={FileText} tone="muted" />
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText
              size={32}
              className="text-muted-foreground mx-auto mb-3"
              strokeWidth={1.8}
            />
            <p className="text-h3 mb-1">No articles yet</p>
            <p className="text-body text-muted-foreground mb-4">
              Author your first article to populate the library.
            </p>
            <Button asChild size="sm">
              <Link href="/admin/education/new">
                <Plus size={14} />
                Create article
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All articles</CardTitle>
            <CardDescription>
              Sorted by most recently updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/admin/education/${article.id}`}
                  className="block px-8 py-4 hover:bg-card/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {article.published ? (
                          <Badge variant="success">Published</Badge>
                        ) : (
                          <Badge variant="default">Draft</Badge>
                        )}
                        {article.category && (
                          <span className="overline">{article.category}</span>
                        )}
                      </div>
                      <div className="text-body font-semibold truncate">
                        {article.title}
                      </div>
                      <div className="text-caption text-muted-foreground mt-0.5 font-mono">
                        /{article.slug}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 shrink-0">
                      <Stat
                        icon={Eye}
                        label="Assigned"
                        value={article.assignedCount}
                      />
                      <Stat
                        icon={BookOpen}
                        label="Read"
                        value={article.readCount}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "success" | "muted";
}) {
  const valueCls =
    tone === "success"
      ? "text-success"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="overline mb-2 inline-flex items-center gap-1.5">
          <Icon size={11} />
          {label}
        </div>
        <div className={`text-h2 font-bold tabular-nums ${valueCls}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="text-right">
      <div className="overline inline-flex items-center gap-1 justify-end mb-0.5">
        <Icon size={10} />
        {label}
      </div>
      <div className="text-body font-bold tabular-nums">{value}</div>
    </div>
  );
}
