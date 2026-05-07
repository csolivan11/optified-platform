"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X, type LucideIcon } from "lucide-react";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface AppShellProps {
  navItems: NavItem[];
  userLabel: string;
  userRole: string;
  roleBadge?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  navItems,
  userLabel,
  userRole,
  roleBadge,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* ─── Sidebar (desktop) ─── */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0",
          "border-r border-border bg-card/40 backdrop-blur-xl"
        )}
      >
        <div className="px-6 pt-7 pb-10">
          <Logo />
        </div>

        <nav className="flex-1 px-3 pb-6 space-y-0.5">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-elevation-1"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                )}
              >
                <Icon size={16} className={active ? "text-success" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-5">
          <UserMenu userLabel={userLabel} userRole={userRole} />
        </div>
      </aside>

      {/* ─── Mobile topbar ─── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-14">
          <Logo size="sm" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
        {mobileOpen && (
          <nav className="px-3 py-3 space-y-0.5 border-t border-border">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                    active
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 lg:ml-64">
        {/* Desktop topbar */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center justify-between border-b border-border bg-background/60 backdrop-blur-xl px-8">
          <div>{roleBadge}</div>
          <div className="flex items-center gap-4">
            <button
              className="relative p-2 rounded-md hover:bg-card/60 transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-danger" />
            </button>
          </div>
        </header>

        <main className="px-6 sm:px-8 lg:px-10 py-8 lg:py-10 pt-20 lg:pt-10 max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
