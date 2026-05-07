import { redirect } from "next/navigation";
import { getCurrentUser, landingPathForRole } from "@/lib/supabase/auth";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(landingPathForRole(user.profile.role));
}
