"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Plus } from "lucide-react";
import {
  createSupplementAction,
  type SupplementActionResult,
} from "./actions";

/**
 * Inline add form pinned at the top of the supplements page.
 * Single row, four inputs, enter to submit. Optimized for fast bulk
 * additions during seed phases.
 */
export function SupplementAddForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [defaultDose, setDefaultDose] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SupplementActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const fd = new FormData();
    fd.append("name", name);
    fd.append("category", category);
    fd.append("default_dose", defaultDose);
    fd.append("notes", notes);

    startTransition(async () => {
      const r = await createSupplementAction(fd);
      if (!r.ok) {
        setResult(r);
        return;
      }
      // Clear and refocus name for the next add
      setName("");
      setCategory("");
      setDefaultDose("");
      setNotes("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Supplement name"
          required
          autoFocus
          disabled={isPending}
          className="md:col-span-3 h-10 rounded-md border border-input bg-card px-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          disabled={isPending}
          className="md:col-span-2 h-10 rounded-md border border-input bg-card px-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
        />
        <input
          type="text"
          value={defaultDose}
          onChange={(e) => setDefaultDose(e.target.value)}
          placeholder="Default dose"
          disabled={isPending}
          className="md:col-span-2 h-10 rounded-md border border-input bg-card px-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          disabled={isPending}
          className="md:col-span-4 h-10 rounded-md border border-input bg-card px-3 text-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
        />
        <button
          type="submit"
          disabled={isPending || name.trim().length < 2}
          className="md:col-span-1 h-10 rounded-md bg-success text-navy-900 font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-success/90 transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          {isPending ? "…" : "Add"}
        </button>
      </div>

      {result?.fieldErrors?.name && (
        <p className="text-caption text-danger inline-flex items-center gap-1.5">
          <AlertCircle size={12} /> {result.fieldErrors.name}
        </p>
      )}
      {result?.error && (
        <p className="text-caption text-danger inline-flex items-center gap-1.5">
          <AlertCircle size={12} /> {result.error}
        </p>
      )}
    </form>
  );
}
