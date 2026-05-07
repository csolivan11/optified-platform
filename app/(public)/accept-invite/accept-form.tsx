"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteAction } from "./actions";

interface Props {
  token: string;
  email: string;
}

export function AcceptInviteForm({ token, email }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const passwordLongEnough = password.length >= 10;
  const passwordsMatch = password === confirm && confirm.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordLongEnough) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await acceptInviteAction(token, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Success. Send them to login with a success flash.
      router.push(`/login?flash=invite_accepted&email=${encodeURIComponent(result.email)}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email-display">Account email</Label>
        <Input
          id="email-display"
          type="email"
          value={email}
          disabled
          readOnly
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Choose a password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordHint ok={passwordLongEnough} text="At least 10 characters" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {confirm.length > 0 && (
          <PasswordHint ok={passwordsMatch} text="Passwords match" />
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-caption">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isPending || !passwordLongEnough || !passwordsMatch}
      >
        {isPending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}

function PasswordHint({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-caption">
      <CheckCircle2
        size={12}
        className={ok ? "text-success" : "text-muted-foreground/40"}
      />
      <span className={ok ? "text-success" : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );
}
