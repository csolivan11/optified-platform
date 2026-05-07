import { MessageSquareText } from "lucide-react";
import type { CoachNoteWithAuthor } from "@/lib/repositories";

interface CoachNoteProps {
  note: CoachNoteWithAuthor;
}

export function CoachNote({ note }: CoachNoteProps) {
  const coachName =
    note.coach.display_name ??
    [note.coach.first_name, note.coach.last_name].filter(Boolean).join(" ") ||
    "Coach";

  const date = new Date(note.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="p-5 rounded-lg border border-accent/20 bg-accent/5">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
          <MessageSquareText size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-caption font-bold text-accent">{coachName}</span>
            <span className="text-overline text-muted-foreground">
              {date}
              {note.week_number !== null && ` · Week ${note.week_number}`}
            </span>
          </div>
        </div>
      </div>
      <p className="text-body text-foreground leading-relaxed whitespace-pre-wrap">
        {note.content}
      </p>
    </div>
  );
}
