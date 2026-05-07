"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import {
  requireNotImpersonating,
  ImpersonationWriteBlockedError,
} from "@/lib/supabase/impersonation";
import {
  supplementsRepo,
  auditRepo,
  AuditActions,
} from "@/lib/repositories";

export interface SupplementActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function guard(): Promise<SupplementActionResult | null> {
  try {
    await requireNotImpersonating();
    return null;
  } catch (err) {
    if (err instanceof ImpersonationWriteBlockedError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

export async function createSupplementAction(
  formData: FormData
): Promise<SupplementActionResult> {
  const admin = await requireRole("admin");
  const blocked = await guard();
  if (blocked) return blocked;

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const default_dose = String(formData.get("default_dose") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || name.length < 2) {
    return { ok: false, fieldErrors: { name: "Name is required." } };
  }

  let supplement;
  try {
    supplement = await supplementsRepo.createSupplement({
      name,
      category: category || null,
      default_dose: default_dose || null,
      notes: notes || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create supplement.";
    if (message.toLowerCase().includes("duplicate")) {
      return {
        ok: false,
        fieldErrors: { name: "A supplement with this name already exists." },
      };
    }
    return { ok: false, error: message };
  }

  const h = headers();
  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: AuditActions.SUPPLEMENT_CREATED,
    resource_type: "supplement",
    resource_id: supplement.id,
    metadata: { name, category },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  revalidatePath("/admin/supplements");
  return { ok: true };
}

export async function updateSupplementAction(
  supplementId: string,
  formData: FormData
): Promise<SupplementActionResult> {
  const admin = await requireRole("admin");
  const blocked = await guard();
  if (blocked) return blocked;

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const default_dose = String(formData.get("default_dose") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || name.length < 2) {
    return { ok: false, fieldErrors: { name: "Name is required." } };
  }

  try {
    await supplementsRepo.updateSupplement(supplementId, {
      name,
      category: category || null,
      default_dose: default_dose || null,
      notes: notes || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update supplement.";
    return { ok: false, error: message };
  }

  const h = headers();
  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: AuditActions.SUPPLEMENT_UPDATED,
    resource_type: "supplement",
    resource_id: supplementId,
    metadata: { name },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  revalidatePath("/admin/supplements");
  return { ok: true };
}

/**
 * Toggle the supplement's active flag. Deactivating preserves history —
 * existing prescriptions remain valid, but the supplement no longer shows
 * up in catalog pickers. Reactivation reverses this.
 */
export async function toggleSupplementActiveAction(
  supplementId: string,
  newActive: boolean
): Promise<SupplementActionResult> {
  const admin = await requireRole("admin");
  const blocked = await guard();
  if (blocked) return blocked;

  try {
    await supplementsRepo.updateSupplement(supplementId, { active: newActive });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update supplement.";
    return { ok: false, error: message };
  }

  const h = headers();
  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: newActive
      ? AuditActions.SUPPLEMENT_REACTIVATED
      : AuditActions.SUPPLEMENT_DEACTIVATED,
    resource_type: "supplement",
    resource_id: supplementId,
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  revalidatePath("/admin/supplements");
  return { ok: true };
}
