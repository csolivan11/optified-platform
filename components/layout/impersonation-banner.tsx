import { Eye } from "lucide-react";
import { stopImpersonationAction } from "@/app/api/impersonation/actions";

interface ImpersonationBannerProps {
  /** Display name or email of the impersonated user, for unambiguous context. */
  impersonatedLabel: string;
}

/**
 * Persistent banner shown across every page while an admin is viewing
 * as another user. Server-rendered (no hydration flicker). The "Exit"
 * button is a real form submitting to a Server Action — works without
 * client-side JS.
 */
export function ImpersonationBanner({ impersonatedLabel }: ImpersonationBannerProps) {
  return (
    <div className="sticky top-0 z-50 bg-warning text-navy-900 shadow-elevation-2">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 h-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={14} className="shrink-0" strokeWidth={2.5} />
          <span className="text-caption font-semibold truncate">
            Viewing as {impersonatedLabel}
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-wider opacity-70">
            · read-only
          </span>
        </div>
        <form action={stopImpersonationAction}>
          <button
            type="submit"
            className="text-caption font-bold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  );
}
