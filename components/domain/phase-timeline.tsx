import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TimelinePhase {
  id: string;
  name: string;
  sequence: number;
  total_tasks: number;
  completed_tasks: number;
}

interface PhaseTimelineProps {
  phases: TimelinePhase[];
  currentPhaseId: string | null;
  className?: string;
}

/**
 * Horizontal phase indicator used on the Program tab. Renders each phase
 * as a numbered step with progress connector lines between them.
 *
 * Phase states:
 *   - complete: all tasks done OR phase comes before current
 *   - active: this is the client's current phase
 *   - upcoming: future phases, locked
 */
export function PhaseTimeline({
  phases,
  currentPhaseId,
  className,
}: PhaseTimelineProps) {
  const currentIdx = currentPhaseId
    ? phases.findIndex((p) => p.id === currentPhaseId)
    : 0;

  return (
    <div className={cn("flex items-start gap-0", className)}>
      {phases.map((phase, i) => {
        const isComplete =
          i < currentIdx ||
          (phase.total_tasks > 0 && phase.completed_tasks >= phase.total_tasks);
        const isActive = i === currentIdx && !isComplete;
        const isUpcoming = i > currentIdx;

        return (
          <div key={phase.id} className="flex-1 flex flex-col items-center relative min-w-0">
            {/* Connector to next phase */}
            {i < phases.length - 1 && (
              <div
                className={cn(
                  "absolute top-[18px] left-[calc(50%+22px)] right-[calc(-50%+22px)] h-0.5 -z-0",
                  isComplete ? "bg-success" : "bg-border"
                )}
              />
            )}

            {/* Step circle */}
            <div
              className={cn(
                "relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                isComplete && "bg-success text-navy-900 shadow-glow-success",
                isActive && "bg-card border-2 border-success text-success",
                isUpcoming && "bg-card border border-border text-muted-foreground"
              )}
            >
              {isComplete ? (
                <Check size={16} strokeWidth={3} />
              ) : isUpcoming ? (
                <Lock size={12} />
              ) : (
                phase.sequence
              )}
            </div>

            {/* Phase label */}
            <div className="mt-3 text-center min-w-0 px-2">
              <div
                className={cn(
                  "text-caption font-semibold truncate",
                  isUpcoming ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {phase.name}
              </div>
              {!isUpcoming && phase.total_tasks > 0 && (
                <div className="text-overline text-muted-foreground mt-1">
                  {phase.completed_tasks}/{phase.total_tasks}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
