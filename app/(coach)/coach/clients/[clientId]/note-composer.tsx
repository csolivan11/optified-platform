"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Eye, EyeOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCoachNoteAction } from "./actions";

interface Props {
  clientId: string;
  defaultWeekNumber?: number | null;
}

/**
 * Minimal, fast coach-note composer. Single textarea, visibility toggle,
 * submit. Submit clears the textarea so the coach can immediately write
 * the next note without friction. Errors surface inline.
 */
export function CoachNoteComposer({ clientId, defaultWeekNumber }: Props) {
  const [content, setContent] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createCoachNoteAction({
        client_id: clientId,
        content,
        week_number: defaultWeekNumber ?? null,
        visible_to_client: visibleToClient,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setContent("");
    });
  };

  const charCount = content.length;
  const nearLimit = charCount > 4500;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a coaching note — observation, protocol change, next focus…"
          disabled={isPending}
          rows={4}
          maxLength={5000}
          className="w-full rounded-md border border-input bg-card/40 px-4 py-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40 resize-none"
        />
        {charCount > 0 && (
          <span
            className={`absolute bottom-2 right-3 text-[10px] tabular-nums ${
              nearLimit ? "text-warning" : "text-muted-foreground"
            }`}
          >
            {charCount}/5000
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger"
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p className="text-caption">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setVisibleToClient(!visibleToClient)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground transition-colors"
        >
          {visibleToClient ? (
            <>
              <Eye size={13} /> Visible to client
            </>
          ) : (
            <>
              <EyeOff size={13} /> Coach-only
            </>
          )}
        </button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || content.trim().length < 3}
        >
          <Send size={13} />
          {isPending ? "Saving…" : "Post note"}
        </Button>
      </div>
    </form>
  );
}
