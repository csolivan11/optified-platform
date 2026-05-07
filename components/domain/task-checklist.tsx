"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TaskWithStatus } from "@/lib/repositories";

interface TaskChecklistProps {
  enrollmentId: string;
  tasks: TaskWithStatus[];
  onToggle: (input: {
    enrollment_id: string;
    task_id: string;
    next_status: "complete" | "pending";
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function TaskChecklist({ enrollmentId, tasks, onToggle }: TaskChecklistProps) {
  // Optimistic state — flip immediately, server reconciles on next render
  const [optimistic, setOptimistic] = useState<Map<string, "complete" | "pending">>(
    new Map()
  );
  const [isPending, startTransition] = useTransition();

  const effectiveStatus = (task: TaskWithStatus): "complete" | "pending" =>
    optimistic.get(task.id) ??
    (task.status === "complete" ? "complete" : "pending");

  const handleToggle = (task: TaskWithStatus) => {
    if (task.auto_detected) return; // auto tasks aren't user-toggleable
    const current = effectiveStatus(task);
    const next = current === "complete" ? "pending" : "complete";

    setOptimistic((m) => new Map(m).set(task.id, next));
    startTransition(async () => {
      const result = await onToggle({
        enrollment_id: enrollmentId,
        task_id: task.id,
        next_status: next,
      });
      if (!result.ok) {
        // Revert
        setOptimistic((m) => {
          const copy = new Map(m);
          copy.delete(task.id);
          return copy;
        });
      }
    });
  };

  if (tasks.length === 0) {
    return (
      <div className="text-body text-muted-foreground py-4 text-center">
        No tasks in this phase yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const status = effectiveStatus(task);
        const isComplete = status === "complete";
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => handleToggle(task)}
              disabled={task.auto_detected || isPending}
              className={cn(
                "group w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                isComplete
                  ? "bg-success/5 border-success/20"
                  : "bg-transparent border-border hover:border-navy-400 hover:bg-card/40",
                task.auto_detected && "cursor-default"
              )}
              aria-pressed={isComplete}
            >
              <span
                className={cn(
                  "shrink-0 w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all",
                  isComplete
                    ? "bg-success border-success text-navy-900"
                    : "bg-transparent border-border group-hover:border-navy-300"
                )}
              >
                {isComplete && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "flex-1 text-body",
                  isComplete
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                )}
              >
                {task.title}
              </span>
              {task.auto_detected && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-overline text-accent bg-accent/10">
                  <Sparkles size={10} />
                  Auto
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
