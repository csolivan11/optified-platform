"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import {
  requireNotImpersonating,
  ImpersonationWriteBlockedError,
} from "@/lib/supabase/impersonation";
import {
  educationRepo,
  auditRepo,
  AuditActions,
} from "@/lib/repositories";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ArticleFormState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function validate(input: {
  slug: string;
  title: string;
  body: string;
}): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.slug || !SLUG_RE.test(input.slug)) {
    errors.slug =
      "Slug must be lowercase letters, digits, and hyphens (e.g. why-creatine).";
  }
  if (!input.title || input.title.length < 3) {
    errors.title = "Title must be at least 3 characters.";
  }
  if (!input.body || input.body.length < 20) {
    errors.body = "Body must be at least 20 characters.";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

async function guard(): Promise<{
  ok: boolean;
  error?: string;
} | null> {
  try {
    await requireNotImpersonating();
    return null;
  } catch (err) {
    if (err instanceof ImpersonationWriteBlockedError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

export async function createArticleAction(
  formData: FormData
): Promise<ArticleFormState> {
  const admin = await requireRole("admin");
  const blocked = await guard();
  if (blocked) return blocked;

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const readTimeRaw = String(formData.get("read_time_min") ?? "").trim();
  const published = formData.get("published") === "on";

  const fieldErrors = validate({ slug, title, body });
  if (fieldErrors) return { ok: false, fieldErrors };

  let article;
  try {
    article = await educationRepo.createArticle({
      slug,
      title,
      excerpt: excerpt || null,
      body,
      category: category || null,
      read_time_min: readTimeRaw ? Number(readTimeRaw) : null,
      published,
      created_by: admin.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create article.";
    if (message.toLowerCase().includes("duplicate")) {
      return {
        ok: false,
        fieldErrors: { slug: "An article with this slug already exists." },
      };
    }
    return { ok: false, error: message };
  }

  const h = headers();
  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: AuditActions.ARTICLE_CREATED,
    resource_type: "education_article",
    resource_id: article.id,
    metadata: { slug, published },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  revalidatePath("/admin/education");
  revalidatePath("/dashboard/education");
  redirect(`/admin/education/${article.id}?flash=created`);
}

export async function updateArticleAction(
  articleId: string,
  formData: FormData
): Promise<ArticleFormState> {
  const admin = await requireRole("admin");
  const blocked = await guard();
  if (blocked) return blocked;

  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const readTimeRaw = String(formData.get("read_time_min") ?? "").trim();
  const published = formData.get("published") === "on";

  // Use existing slug since admin can't edit slug post-creation
  const existing = await educationRepo.findByIdForAdmin(articleId);
  if (!existing) return { ok: false, error: "Article not found." };

  const fieldErrors = validate({ slug: existing.slug, title, body });
  if (fieldErrors) return { ok: false, fieldErrors };

  try {
    await educationRepo.updateArticle(articleId, {
      title,
      excerpt: excerpt || null,
      body,
      category: category || null,
      read_time_min: readTimeRaw ? Number(readTimeRaw) : null,
      published,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update article.";
    return { ok: false, error: message };
  }

  const h = headers();
  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: AuditActions.ARTICLE_UPDATED,
    resource_type: "education_article",
    resource_id: articleId,
    metadata: { published_after: published },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  revalidatePath(`/admin/education/${articleId}`);
  revalidatePath("/admin/education");
  revalidatePath("/dashboard/education");
  return { ok: true };
}
