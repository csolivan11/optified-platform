"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ClientSupplementWithAdherence } from "@/lib/repositories";

interface SupplementAdherenceGridProps {
  supplements: ClientSupplementWithAdherence[];
  onRecord: (input: {
    client_supplement_id: string;
    date: string;
    taken: boolean;
  }) => Promise<{ ok: boolean }>;
}

const DOW_LABEL = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * 7-day adherence grid. Each cell shows: green check (taken),
 * red X (not taken), or grey dash (no record).
 *
 * Today's cell is interactive — clicking cycles through:
 *   no record → taken → not taken → no record
 *
 * Past days are read-only here. Editing past entries lives in a
 * separate "history" view to avoid accidental edits.
 */
export function SupplementAdherenceGrid({
  supplements,
  onRecord,
}: SupplementAdherenceGridProps) {
  // Optimistic state keyed by `${rxId}:${date}` -> taken|null
  const [optimistic, setOptimistic] = useState<Map<string, boolean | null>>(new Map());
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const cellState = (
    rxId: string,
    date: string,
    seedTaken: boolean | null
  ): boolean | null => {
    const key = `${rxId}:${date}`;
    return optimistic.has(key) ? optimistic.get(key)! : seedTaken;
  };

  const handleCellClick = (rxId: string, date: string, currentValue: boolean | null) => {
    if (date !== today) return;

    // Cycle: null -> true -> false -> null
    const next = currentValue === null ? true : currentValue === true ? false : null;
    const key = `${rxId}:${date}`;

    setOptimistic((m) => new Map(m).set(key, next));

    startTransition(async () => {
      // null is "no record" — but the table doesn't support deletion via this
      // path, so we treat null as a request to record `false` and treat the
      // UI cycle as advisory. Beta simplification.
      const taken = next === null ? false : next;
      const result = await onRecord({
        client_supplement_id: rxId,
        date,
        taken,
      });
      if (!result.ok) {
        // Revert
        setOptimistic((m) => {
          const copy = new Map(m);
          copy.delete(key);
          return copy;
        });
      }
    });
  };

  if (supplements.length === 0) {
    return (
      <div className="text-body text-muted-foreground py-4">
        No supplements prescribed yet. Your coach will add your protocol after your intake.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {supplements.map((rx) => (
        <div key={rx.id} className="flex items-center gap-4 flex-wrap">
          {/* Name */}
          <div className="min-w-[180px] flex-shrink-0">
            <div className="text-body font-semibold">{rx.supplement.name}</div>
            <div className="text-caption text-muted-foreground">
              {rx.dose} · {rx.frequency}
            </div>
          </div>

          {/* 7-day grid */}
          <div className="flex gap-1.5 flex-shrink-0">
            {rx.weekAdherence.map((day, i) => {
              const value = cellState(rx.id, day.date, day.taken);
              const isToday = day.date === today;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!isToday}
                  onClick={() => handleCellClick(rx.id, day.date, value)}
                  className={cn(
                    "w-7 h-7 rounded-md border flex items-center justify-center text-overline font-bold transition-all",
                    isToday && "ring-1 ring-success/40 ring-offset-1 ring-offset-background",
                    value === true &&
                      "bg-success/15 border-success/30 text-success",
                    value === false &&
                      "bg-danger/10 border-danger/30 text-danger",
                    value === null &&
                      "bg-transparent border-border text-muted-foreground/40",
                    isToday && "cursor-pointer hover:border-success",
                    !isToday && "cursor-default"
                  )}
                  aria-label={`${rx.supplement.name} on ${day.date}: ${
                    value === true ? "taken" : value === false ? "not taken" : "no record"
                  }`}
                >
                  {value === true && <Check size={11} strokeWidth={3} />}
                  {value === false && <X size={11} strokeWidth={3} />}
                  {value === null && DOW_LABEL[new Date(day.date + "T00:00:00").getDay()]}
                </button>
              );
            })}
          </div>

          {/* Adherence % */}
          <div className="flex-1 min-w-[120px] flex items-center gap-3">
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  rx.adherencePercent === null
                    ? "bg-muted-foreground/30 w-0"
                    : rx.adherencePercent >= 80
                    ? "bg-success"
                    : "bg-warning"
                )}
                style={{
                  width: rx.adherencePercent !== null ? `${rx.adherencePercent}%` : 0,
                }}
              />
            </div>
            <span
              className={cn(
                "text-caption font-bold tabular-nums w-10 text-right",
                rx.adherencePercent === null
                  ? "text-muted-foreground"
                  : rx.adherencePercent >= 80
                  ? "text-success"
                  : "text-warning"
              )}
            >
              {rx.adherencePercent !== null ? `${rx.adherencePercent}%` : "—"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
