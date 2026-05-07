import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { invitesRepo } from "@/lib/repositories";
import { InviteForm } from "./invite-form";
import { ViewAsClientList } from "./view-as-client-list";

export default async function UsersPage() {
  const invites = await invitesRepo.list(20).catch(() => []);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Invite new clients, coaches, and admins. Open client dashboards for support."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Invite form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Send invitation</CardTitle>
              <CardDescription>
                Invitations expire 72 hours after sending.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>
        </div>

        {/* Recent invites */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Recent invitations</CardTitle>
              <CardDescription>
                Last 20 invitations sent, any status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {invites.length === 0 ? (
                <p className="px-8 pb-8 text-body text-muted-foreground">
                  No invitations sent yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between px-8 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-body font-semibold truncate">
                          {invite.email}
                        </div>
                        <div className="text-caption text-muted-foreground">
                          Invited{" "}
                          {new Date(invite.invited_at).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" }
                          )}{" "}
                          · Role: {invite.role}
                        </div>
                      </div>
                      <Badge variant={statusVariant(invite.status)}>
                        {invite.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View-as-Client */}
      <ViewAsClientList />
    </>
  );
}

function statusVariant(
  status: string
): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "pending":
      return "warning";
    case "accepted":
      return "success";
    case "expired":
      return "default";
    case "revoked":
      return "danger";
    default:
      return "default";
  }
}
