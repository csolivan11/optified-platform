import { CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

interface PageProps {
  searchParams: { flash?: string; email?: string };
}

export default function LoginPage({ searchParams }: PageProps) {
  const flash = searchParams.flash;
  const email = searchParams.email;

  const flashMessage = flash ? getFlashMessage(flash, email) : null;

  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to continue your optimization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {flashMessage && (
          <div className="flex items-start gap-3 p-3 rounded-md bg-success/10 border border-success/30">
            <CheckCircle2
              size={16}
              className="text-success shrink-0 mt-0.5"
            />
            <p className="text-caption text-foreground">{flashMessage}</p>
          </div>
        )}
        <LoginForm />
        <p className="text-center text-caption text-muted-foreground">
          Optified is invite-only. Contact your coach if you need access.
        </p>
      </CardContent>
    </Card>
  );
}

function getFlashMessage(flash: string, email?: string): string | null {
  switch (flash) {
    case "invite_accepted":
      return email
        ? `Account created. Sign in with ${email} to continue.`
        : "Account created. Sign in to continue.";
    case "password_reset":
      return "Password updated. Sign in with your new password.";
    default:
      return null;
  }
}
