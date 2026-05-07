import "server-only";
import { Repository } from "./base";
import type { EducationArticle, ClientArticleAssignment } from "@/lib/types/database";

export interface AssignedArticle extends EducationArticle {
  assignment_id: string;
  assignment_reason: string | null;
  assigned_at: string;
  read_at: string | null;
}

export class EducationRepository extends Repository {
  /**
   * Articles personalized to this client — the "For You" section.
   * Sorted by unread first, then most-recently-assigned.
   */
  async listAssignedForClient(
    clientId: string,
    limit: number = 10
  ): Promise<AssignedArticle[]> {
    const { data, error } = await this.client
      .from("client_article_assignments")
      .select(
        `
        id,
        reason,
        assigned_at,
        read_at,
        article:education_articles!inner(*)
        `
      )
      .eq("client_id", clientId)
      .order("read_at", { ascending: true, nullsFirst: true })
      .order("assigned_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[education.listAssignedForClient]", error);
      throw error;
    }

    return (data ?? []).map((row: {
      id: string;
      reason: string | null;
      assigned_at: string;
      read_at: string | null;
      article: EducationArticle;
    }) => ({
      ...row.article,
      assignment_id: row.id,
      assignment_reason: row.reason,
      assigned_at: row.assigned_at,
      read_at: row.read_at,
    })) as AssignedArticle[];
  }

  /**
   * Browsable library — published articles, optionally filtered by category.
   */
  async listLibrary(category?: string, limit: number = 50): Promise<EducationArticle[]> {
    let q = this.client
      .from("education_articles")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (category) q = q.eq("category", category);

    const { data, error } = await q;
    if (error) {
      console.error("[education.listLibrary]", error);
      throw error;
    }
    return (data ?? []) as EducationArticle[];
  }

  /**
   * Distinct categories present in published articles. Used to render
   * the category filter pills.
   */
  async listCategories(): Promise<string[]> {
    const { data, error } = await this.client
      .from("education_articles")
      .select("category")
      .eq("published", true)
      .not("category", "is", null);

    if (error) {
      console.error("[education.listCategories]", error);
      throw error;
    }

    const set = new Set<string>();
    for (const row of data ?? []) {
      if (row.category) set.add(row.category);
    }
    return Array.from(set).sort();
  }

  /**
   * Fetch a single article by slug. Returns null if not found or unpublished
   * (RLS enforces published-only for non-admins, but we double-check).
   */
  async findBySlug(slug: string): Promise<EducationArticle | null> {
    const { data, error } = await this.client
      .from("education_articles")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (error) {
      console.error("[education.findBySlug]", error);
      throw error;
    }
    return data as EducationArticle | null;
  }

  /**
   * Mark an article as read by the client. Idempotent — sets read_at if
   * not already set.
   */
  async markRead(clientId: string, articleId: string): Promise<void> {
    // Find the assignment row (if any). If client is reading from the
    // library without a matching assignment, no-op silently.
    const { data: assignment, error: findError } = await this.client
      .from("client_article_assignments")
      .select("id, read_at")
      .eq("client_id", clientId)
      .eq("article_id", articleId)
      .maybeSingle();

    if (findError) {
      console.error("[education.markRead findError]", findError);
      return;
    }
    if (!assignment || assignment.read_at) return;

    const { error: updateError } = await this.client
      .from("client_article_assignments")
      .update({ read_at: new Date().toISOString() })
      .eq("id", assignment.id);

    if (updateError) {
      console.error("[education.markRead updateError]", updateError);
    }
  }
}

export const educationRepo = new EducationRepository();

// ─── Admin-facing extensions ────────────────────────────────

export interface ArticleAdminListItem extends EducationArticle {
  assignedCount: number;
  readCount: number;
}

export interface CreateArticleInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  category?: string | null;
  read_time_min?: number | null;
  cover_image_url?: string | null;
  published: boolean;
  created_by: string;
}

export interface UpdateArticleInput {
  title?: string;
  excerpt?: string | null;
  body?: string;
  category?: string | null;
  read_time_min?: number | null;
  cover_image_url?: string | null;
  published?: boolean;
}

declare module "./education" {
  interface EducationRepository {
    listForAdmin(): Promise<ArticleAdminListItem[]>;
    findByIdForAdmin(id: string): Promise<EducationArticle | null>;
    createArticle(input: CreateArticleInput): Promise<EducationArticle>;
    updateArticle(
      id: string,
      patch: UpdateArticleInput
    ): Promise<EducationArticle>;
  }
}

EducationRepository.prototype.listForAdmin = async function (): Promise<
  ArticleAdminListItem[]
> {
  // Admins see published + draft. RLS allows admin reads regardless of published.
  const [articlesR, assignmentsR] = await Promise.all([
    this.client
      .from("education_articles")
      .select("*")
      .order("updated_at", { ascending: false }),
    this.client.from("client_article_assignments").select("article_id, read_at"),
  ]);

  if (articlesR.error) throw articlesR.error;

  const counts = new Map<string, { assigned: number; read: number }>();
  for (const a of assignmentsR.data ?? []) {
    const existing = counts.get(a.article_id) ?? { assigned: 0, read: 0 };
    existing.assigned += 1;
    if (a.read_at) existing.read += 1;
    counts.set(a.article_id, existing);
  }

  return ((articlesR.data ?? []) as EducationArticle[]).map((a) => {
    const c = counts.get(a.id) ?? { assigned: 0, read: 0 };
    return {
      ...a,
      assignedCount: c.assigned,
      readCount: c.read,
    };
  });
};

EducationRepository.prototype.findByIdForAdmin = async function (
  id: string
): Promise<EducationArticle | null> {
  // Admin lookup ignores published flag — we need to edit drafts.
  const { data, error } = await this.client
    .from("education_articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as EducationArticle | null;
};

EducationRepository.prototype.createArticle = async function (
  input: CreateArticleInput
): Promise<EducationArticle> {
  const { data, error } = await this.client
    .from("education_articles")
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      body: input.body,
      category: input.category ?? null,
      read_time_min: input.read_time_min ?? null,
      cover_image_url: input.cover_image_url ?? null,
      published: input.published,
      published_at: input.published ? new Date().toISOString() : null,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EducationArticle;
};

EducationRepository.prototype.updateArticle = async function (
  id: string,
  patch: UpdateArticleInput
): Promise<EducationArticle> {
  // If transitioning to published and published_at is null, set it now.
  // Existing published_at is preserved on subsequent edits to published=true.
  const updates: Record<string, unknown> = { ...patch };
  if (patch.published === true) {
    const current = await this.findByIdForAdmin(id);
    if (current && !current.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await this.client
    .from("education_articles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as EducationArticle;
};
