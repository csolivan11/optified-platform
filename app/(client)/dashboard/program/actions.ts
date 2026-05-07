"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { programsRepo } from "@/lib/repositories";

export async function toggleTaskAction(input: {
  enrollment_id: string;
  task_id: string;
  next_status: "complete" | "pending";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireRole("client");
    await programsRepo.setTaskStatus({
      enrollment_id: input.enrollment_id,
      task_id: input.task_id,
      status: input.next_status,
      completed_by: user.id,
    });
    revalidatePath("/dashboard/program");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("[toggleTaskAction]", err);
    return { ok: false, error: "Could not update task. Please try again." };
  }
}
