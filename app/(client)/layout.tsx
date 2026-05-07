import {
  Home,
  Heart,
  TestTube,
  FileText,
  Zap,
  Target,
  BookOpen,
  Settings,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { requireRole } from "@/lib/supabase/auth";
import { getImpersonationContext } from "@/lib/supabase/impersonation";
import { profilesRepo } from "@/lib/repositories";

const clientNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: Home },
  { label: "Biomarkers", href: "/dashboard/biomarkers", icon: Heart },
  { label: "Bloodwork", href: "/dashboard/bloodwork", icon: TestTube },
  { label: "Specialty Testing", href: "/dashboard/specialty", icon: FileText },
  { label: "Functional Metrics", href: "/dashboard/functional", icon: Zap },
  { label: "Program", href: "/dashboard/program", icon: Target },
  { label: "Education", href: "/dashboard/education", icon: BookOpen },
  { label: "Tools", href: "/dashboard/tools", icon: Settings },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireRole("client") admits clients AND admins (admin-bypass is intentional).
  // Coaches are redirected away to /coach. This is what enables admins to land
  // in the client dashboard during impersonation without a separate route tree.
  await requireRole("client");

  const ctx = await getImpersonationContext();

  // Decide whose name to render in the sidebar shell.
  // - Not impersonating: real user (a client signed in as themselves).
  // - Impersonating: fetch the impersonated client's profile so the
  //   shell shows that person's identity (matches what they would see).
  let displayName: string;
  let userRoleLabel = "Member";

  if (ctx.isImpersonating && ctx.impersonatedClientId) {
    const impersonated = await profilesRepo
      .findById(ctx.impersonatedClientId)
      .catch(() => null);
    if (impersonated) {
      displayName =
        impersonated.display_name ??
        [impersonated.first_name, impersonated.last_name]
          .filter(Boolean)
          .join(" ") ||
        impersonated.email;
    } else {
      displayName = "Unknown client";
    }
  } else {
    displayName =
      ctx.realUser.profile.display_name ??
      [ctx.realUser.profile.first_name, ctx.realUser.profile.last_name]
        .filter(Boolean)
        .join(" ") ||
      ctx.realUser.email;
  }

  return (
    <>
      {ctx.isImpersonating && (
        <ImpersonationBanner impersonatedLabel={displayName} />
      )}
      <AppShell
        navItems={clientNav}
        userLabel={displayName}
        userRole={userRoleLabel}
      >
        {children}
      </AppShell>
    </>
  );
}
