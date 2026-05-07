import "server-only";
import { Repository } from "./base";
import type { CoachNote, Profile } from "@/lib/types/database";

export interface CoachNoteWithAuthor extends CoachNote {
  coach: Pick<Profile, "id" | "first_name" | "last_name" | "display_name">;
}

export interface CreateCoachNoteInput {
  client_id: string;
  coach_id: string;
  content: string;
  week_number?: number;
  visible_to_client?: boolean;
}

export class CoachNotesRepository extends Repository {
  /**
   * Visible coach notes for a client. RLS handles the visibility logic
   * (clients see only `visible_to_client = true` and not soft-deleted;
   * coaches and admins see everything).
   */
  async listForClient(
    clientId: string,
    limit: number = 10
  ): Promise<CoachNoteWithAuthor[]> {
    const { data, error } = await this.client
      .from("coach_notes")
      .select(
        `
        *,
        coach:profiles!coach_notes_coach_id_fkey(id, first_name, last_name, display_name)
        `
      )
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[coachNotes.listForClient]", error);
      throw error;
    }
    return (data ?? []) as CoachNoteWithAuthor[];
  }

  /**
   * Write a new coach note. RLS enforces that the caller is a coach
   * assigned to `client_id` AND that coach_id = auth.uid() — so we can't
   * write a note on someone else's behalf.
   */
  async create(input: CreateCoachNoteInput): Promise<CoachNote> {
    const { data, error } = await this.client
      .from("coach_notes")
      .insert({
        client_id: input.client_id,
        coach_id: input.coach_id,
        content: input.content,
        week_number: input.week_number ?? null,
        visible_to_client: input.visible_to_client ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("[coachNotes.create]", error);
      throw error;
    }
    return data as CoachNote;
  }

  /**
   * Update note content or visibility. RLS enforces authoring coach or admin.
   */
  async update(
    noteId: string,
    patch: { content?: string; visible_to_client?: boolean }
  ): Promise<CoachNote> {
    const { data, error } = await this.client
      .from("coach_notes")
      .update(patch)
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      console.error("[coachNotes.update]", error);
      throw error;
    }
    return data as CoachNote;
  }

  /**
   * Soft delete (sets deleted_at). Readable history preserved for audit.
   */
  async softDelete(noteId: string): Promise<void> {
    const { error } = await this.client
      .from("coach_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", noteId);

    if (error) {
      console.error("[coachNotes.softDelete]", error);
      throw error;
    }
  }
}

export const coachNotesRepo = new CoachNotesRepository();
