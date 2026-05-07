import { Users, TrendingUp, Bell, Clipboard } from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/supabase/auth";

const coachNav: NavItem[] = [
  { label: "Client Pipeline", href: "/coach", icon: Users },
  { label: "Outcomes", href: "/coach/outcomes", icon: TrendingUp },
  { label: "Alerts", href: "/coach/alerts", icon: Bell },
  { label: "Operations", href: "/coach/operations", icon: Clipboard },
];

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Role gate: coaches and admins only.
  const user = await requireRole("coach");

  const displayName =
    user.profile.display_name ??
    [user.profile.first_name, user.profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email;

  return (
    <AppShell
      navItems={coachNav}
      userLabel={displayName}
      userRole={user.profile.role === "admin" ? "Admin (Coach view)" : "Coach"}
      roleBadge={<Badge variant="info">Coach View</Badge>}
    >
      {children}
    </AppShell>
  );
}
