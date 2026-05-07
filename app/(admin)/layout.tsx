import { Target, BookOpen, Pill, Users, FileText } from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/supabase/auth";

const adminNav: NavItem[] = [
  { label: "Programs", href: "/admin/programs", icon: Target },
  { label: "Education", href: "/admin/education", icon: BookOpen },
  { label: "Supplements", href: "/admin/supplements", icon: Pill },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Audit Log", href: "/admin/audit-log", icon: FileText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Strict: admin only (coaches cannot access admin surfaces).
  const user = await requireRole("admin");

  const displayName =
    user.profile.display_name ??
    [user.profile.first_name, user.profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email;

  return (
    <AppShell
      navItems={adminNav}
      userLabel={displayName}
      userRole="System Administrator"
      roleBadge={<Badge variant="accent">Admin Console</Badge>}
    >
      {children}
    </AppShell>
  );
}
