"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(public)/login/actions";

interface UserMenuProps {
  userLabel: string;
  userRole: string;
}

export function UserMenu({ userLabel, userRole }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  const initials = userLabel
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success font-semibold text-xs">
        {initials || "·"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{userLabel}</div>
        <div className="text-overline text-muted-foreground">{userRole}</div>
      </div>
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors disabled:opacity-40"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}
