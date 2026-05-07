"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  Pencil,
  X,
} from "lucide-react";
import {
  updateSupplementAction,
  toggleSupplementActiveAction,
  type SupplementActionResult,
} from "./actions";
import type { SupplementAdminListItem } from "@/lib/repositories";

interface Props {
  supplement: SupplementAdminListItem;
}

/**
 * Single supplement row. Click anywhere on the row to expand inline-edit.
 * Save/Cancel collapses. Deactivate toggle on the right.
 *
 * Optimized for speed: every action is one click. No modals, no nav.
 */
export function SupplementRow({ supplement }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(supplement.name);
  const [category, setCategory] = useState(supplement.category ?? "");
  const [defaultDose, setDefaultDose] = useState(supplement.default_dose ?? "");
  const [notes, setNotes] = useState(supplement.notes ?? "");
  const [result, setResult] = useState<SupplementActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setResult(null);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("category", category);
    fd.append("default_dose", defaultDose);
    fd.append("notes", notes);

    startTransition(async () => {
      const r = await updateSupplementAction(supplement.id, fd);
      if (!r.ok) {
        setResult(r);
        return;
      }
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setName(supplement.name);
    setCategory(supplement.category ?? "");
    setDefaultDose(supplement.default_dose ?? "");
    setNotes(supplement.notes ?? "");
    setResult(null);
    setEditing(false);
  };

  const handleToggleActive = () => {
    setResult(null);
    startTransition(async () => {
      const r = await toggleSupplementActiveAction(
        supplement.id,
        !supplement.active
      );
      if (!r.ok) setResult(r);
    });
  };

  const inUse = supplement.activePrescriptionCount > 0;

  return (
    <div
      className={
        supplement.active
          ? "border-b border-border last:border-0"
          : "border-b border-border last:border-0 opacity-60"
      }
    >
      {/* Row summary */}
      <div className="flex items-center gap-4 px-6 py-3">
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left group"
        >
          <ChevronDown
            size={14}
            className={
              editing
                ? "text-foreground transition-transform"
                : "text-muted-foreground -rotate-90 transition-transform group-hover:text-foreground"
            }
          />
          <div className="min-w-0 flex-1">
            <div className="text-body font-semibold truncate">
              {supplement.name}
              {!supplement.active && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  · Archived
                </span>
              )}
            </div>
            <div className="text-caption text-muted-foreground truncate">
              {[supplement.category, supplement.default_dose]
                .filter(Boolean)
                .join(" · ") || <span className="italic">No metadata</span>}
            </div>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-6 shrink-0">
          <div className="text-right">
            <div className="overline">In use</div>
            <div
              className={
                inUse
                  ? "text-body font-bold tabular-nums text-success"
                  : "text-body font-bold tabular-nums text-muted-foreground"
              }
            >
              {supplement.activePrescriptionCount}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleActive}
          disabled={isPending}
          title={supplement.active ? "Archive supplement" : "Reactivate supplement"}
          className={
            supplement.active
              ? "p-2 rounded-md text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
              : "p-2 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors disabled:opacity-50"
          }
        >
          {supplement.active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
        </button>
      </div>

      {/* Edit form (expanded) */}
      {editing && (
        <div className="px-6 pb-5 pt-1 border-t border-border bg-card/40 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <Field label="Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-body focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
              />
              {result?.fieldErrors?.name && (
                <p className="text-caption text-danger mt-1">
                  {result.fieldErrors.name}
                </p>
              )}
            </Field>
            <Field label="Category">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isPending}
                placeholder="Sleep, Inflammation, …"
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
              />
            </Field>
            <Field label="Default dose">
              <input
                type="text"
                value={defaultDose}
                onChange={(e) => setDefaultDose(e.target.value)}
                disabled={isPending}
                placeholder="400mg, 5g, …"
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Notes">
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                placeholder="Timing, interactions, evidence quality, brand preferences…"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40 resize-none"
              />
            </Field>
          </div>

          {result?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 mt-3 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger"
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p className="text-caption">{result.error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X size={13} />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold bg-success text-navy-900 hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              <Check size={13} />
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="overline mb-1.5 block">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
