"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/domain/markdown";
import {
  createArticleAction,
  updateArticleAction,
  type ArticleFormState,
} from "./actions";

export interface ArticleEditorProps {
  mode: "create" | "edit";
  initial?: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    category: string | null;
    read_time_min: number | null;
    published: boolean;
  };
}

export function ArticleEditor({ mode, initial }: ArticleEditorProps) {
  const router = useRouter();

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [readTime, setReadTime] = useState(
    initial?.read_time_min ? String(initial.read_time_min) : ""
  );
  const [published, setPublished] = useState(initial?.published ?? false);

  const [view, setView] = useState<"edit" | "preview">("edit");
  const [state, setState] = useState<ArticleFormState | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setState(null);

    const fd = new FormData();
    if (mode === "create") fd.append("slug", slug);
    fd.append("title", title);
    fd.append("excerpt", excerpt);
    fd.append("body", body);
    fd.append("category", category);
    fd.append("read_time_min", readTime);
    if (published) fd.append("published", "on");

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createArticleAction(fd)
          : await updateArticleAction(initial!.id, fd);
      // createArticleAction redirects on success and never returns
      if (!result.ok) {
        setState(result);
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  };

  const fieldError = (key: string) => state?.fieldErrors?.[key];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Top action row */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border sticky top-16 z-10 bg-background/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ToggleButton
            active={view === "edit"}
            onClick={() => setView("edit")}
            icon={Pencil}
            label="Edit"
          />
          <ToggleButton
            active={view === "preview"}
            onClick={() => setView("preview")}
            icon={Eye}
            label="Preview"
          />
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-caption text-success inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Saved {timeAgo(savedAt)}
            </span>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-success"
              disabled={isPending}
            />
            <span className="text-caption font-semibold">
              {published ? "Published" : "Draft"}
            </span>
          </label>
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger"
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p className="text-caption">{state.error}</p>
        </div>
      )}

      {/* Metadata grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              type="text"
              required
              placeholder="why-creatine-matters"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "")
                )
              }
              disabled={isPending}
            />
            {fieldError("slug") && (
              <p className="text-caption text-danger">{fieldError("slug")}</p>
            )}
            <p className="text-caption text-muted-foreground">
              Cannot be changed after creation.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            type="text"
            placeholder="Metabolic Health"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="read_time_min">Read time (minutes)</Label>
          <Input
            id="read_time_min"
            type="number"
            min={1}
            max={60}
            placeholder="5"
            value={readTime}
            onChange={(e) => setReadTime(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Title + excerpt */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          className="text-base"
        />
        {fieldError("title") && (
          <p className="text-caption text-danger">{fieldError("title")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <textarea
          id="excerpt"
          rows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          disabled={isPending}
          placeholder="Short summary shown in cards and at the top of the article."
          className="w-full rounded-md border border-input bg-card/40 px-4 py-2 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40 resize-none"
        />
      </div>

      {/* Body — edit or preview */}
      <div className="space-y-2">
        <Label htmlFor="body">Body (markdown)</Label>
        {view === "edit" ? (
          <textarea
            id="body"
            rows={20}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isPending}
            placeholder={`# Article heading\n\nFirst paragraph...\n\n## Subheading\n\nSupporting points:\n- one\n- two`}
            className="w-full rounded-md border border-input bg-card/40 px-4 py-3 text-body font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40 resize-y"
          />
        ) : (
          <div className="rounded-md border border-border bg-card p-8 min-h-[400px]">
            {body.trim() === "" ? (
              <p className="text-body text-muted-foreground italic">
                Nothing to preview yet. Switch back to Edit to write the body.
              </p>
            ) : (
              <Markdown source={body} />
            )}
          </div>
        )}
        {fieldError("body") && (
          <p className="text-caption text-danger">{fieldError("body")}</p>
        )}
        <p className="text-caption text-muted-foreground">
          Supports: # headings, paragraphs, - lists, 1. numbered lists,
          **bold**, *italic*, `code`.
        </p>
      </div>
    </form>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold bg-card text-foreground border border-border shadow-elevation-1"
          : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium text-muted-foreground hover:text-foreground"
      }
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
