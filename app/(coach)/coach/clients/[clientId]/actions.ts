"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import {
  requireNotImpersonating,
  ImpersonationWriteBlockedError,
} from "@/lib/supabase/impersonation";
import {
  coachNotesRepo,
  auditRepo,
  AuditActions,
} from "@/lib/repositories";

export type CreateNoteResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Post a new coach note against a client. RLS enforces that the caller is
 * a coach assigned to this client (or an admin) AND that coach_id matches
 * auth.uid() — so the note cannot be written on someone else's behalf.
 */
export async function createCoachNoteAction(input: {
  client_id: string;
  content: string;
  week_number?: number | null;
  visible_to_client: boolean;
}): Promise<CreateNoteResult> {
  const user = await requireRole("coach");
  const h = headers();

  // Block writes during impersonation. Failing closed at the action
  // boundary is safer than relying on disabled UI.
  try {
    await requireNotImpersonating();
  } catch (err) {
    if (err instanceof ImpersonationWriteBlockedError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const content = input.content?.trim();
  if (!content || content.length < 3) {
    return { ok: false, error: "Note content is too short." };
  }
  if (content.length > 5000) {
    return { ok: false, error: "Note is too long (5000 character max)." };
  }

  let note;
  try {
    note = await coachNotesRepo.create({
      client_id: input.client_id,
      coach_id: user.id,
      content,
      week_number: input.week_number ?? undefined,
      visible_to_client: input.visible_to_client,
    });
  } catch (err) {
    console.error("[createCoachNoteAction]", err);
    return {
      ok: false,
      error: "Could not save the note. You may not be assigned to this client.",
    };
  }

  await auditRepo.write({
    actor_id: user.id,
    actor_role: user.profile.role,
    action: AuditActions.COACH_NOTE_CREATED,
    resource_type: "coach_note",
    resource_id: note.id,
    target_client_id: input.client_id,
    metadata: { visible_to_client: input.visible_to_client },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  // Revalidate the client detail page so the new note appears
  revalidatePath(`/coach/clients/${input.client_id}`);
  return { ok: true };
}

/**
 * Record that a coach viewed a specific client's record. Called from the
 * detail page as a fire-and-forget audit event. Per your specification
 * — audit every viewed_client action.
 */
export async function recordClientViewAction(clientId: string): Promise<void> {
  try {
    const user = await requireRole("coach");
    const h = headers();
    await auditRepo.write({
      actor_id: user.id,
      actor_role: user.profile.role,
      action: AuditActions.CLIENT_VIEWED,
      resource_type: "profile",
      resource_id: clientId,
      target_client_id: clientId,
      ip_address: h.get("x-forwarded-for") ?? undefined,
      user_agent: h.get("user-agent") ?? undefined,
    });
  } catch (err) {
    // Silent — audit failures never block UI
    console.error("[recordClientViewAction]", err);
  }
}
