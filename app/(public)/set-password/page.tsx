import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Create a new password for your Optified account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SetPasswordForm />
      </CardContent>
    </Card>
  );
}
