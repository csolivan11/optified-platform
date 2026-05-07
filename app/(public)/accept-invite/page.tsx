import { invitesRepo } from "@/lib/repositories";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInviteForm } from "./accept-form";

interface PageProps {
  searchParams: { token?: string };
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const token = searchParams.token;

  // No token at all → show a generic error
  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation link missing</CardTitle>
          <CardDescription>
            This URL doesn&apos;t include an invitation token. Please use the
            link from your invitation email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full" size="lg">
            <a href="/login">Go to sign in</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Validate token server-side before rendering the form. If invalid or
  // expired, show the error up front rather than letting the user type
  // a password only to find out the invite is dead.
  const invite = await invitesRepo.lookupByToken(token).catch(() => null);

  if (!invite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation is no longer valid</CardTitle>
          <CardDescription>
            The link has expired, already been used, or was cancelled. Please
            ask your coach to send you a new invitation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full" size="lg">
            <a href="/login">Go to sign in</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>Welcome to Optified</CardTitle>
        <CardDescription>
          {invite.first_name
            ? `Hi ${invite.first_name}. Create a password to finish setting up your account.`
            : "Create a password to finish setting up your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm token={token} email={invite.email} />
      </CardContent>
    </Card>
  );
}
