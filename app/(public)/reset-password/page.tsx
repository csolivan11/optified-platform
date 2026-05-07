import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequestResetForm } from "./request-form";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter the email associated with your account and we&apos;ll send you
          a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RequestResetForm />
      </CardContent>
    </Card>
  );
}
