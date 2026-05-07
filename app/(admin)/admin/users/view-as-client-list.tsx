import { Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { profilesRepo } from "@/lib/repositories";
import { startImpersonationAction } from "@/app/api/impersonation/actions";

/**
 * Server-rendered list of clients with a "View as" form per row.
 *
 * Each row is its own form binding the client_id, so submission goes
 * directly to startImpersonationAction without client-side JS. Pure
 * progressive enhancement.
 */
export async function ViewAsClientList() {
  const clients = await profilesRepo.listAllClients(50).catch(() => []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>View as client</CardTitle>
        <CardDescription>
          Open a client&apos;s dashboard exactly as they see it. Read-only.
          Every view is recorded in the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {clients.length === 0 ? (
          <p className="px-8 pb-8 text-body text-muted-foreground">
            No client accounts yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {clients.map((client) => {
              const displayName =
                client.display_name ??
                [client.first_name, client.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                client.email;
              const initials = displayName
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("");

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-3 px-8 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success font-semibold text-xs shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-caption font-semibold truncate">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {client.email}
                      </div>
                    </div>
                  </div>
                  <form action={startImpersonationAction}>
                    <input type="hidden" name="client_id" value={client.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold text-warning border border-warning/30 hover:bg-warning/10 transition-colors"
                    >
                      <Eye size={12} />
                      View as
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
