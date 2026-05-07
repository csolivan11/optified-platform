"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { supplementsRepo } from "@/lib/repositories";

export async function recordAdherenceAction(input: {
  client_supplement_id: string;
  date: string;
  taken: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole("client");
    await supplementsRepo.recordAdherence({
      client_supplement_id: input.client_supplement_id,
      date: input.date,
      taken: input.taken,
      recorded_via: "manual",
    });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("[recordAdherenceAction]", err);
    return { ok: false, error: "Could not save adherence." };
  }
}
