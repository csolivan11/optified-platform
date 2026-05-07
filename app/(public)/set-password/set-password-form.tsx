"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { setPasswordAction } from "./actions";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // On mount: verify that Supabase has established a recovery session from
  // the URL hash. The Supabase client auto-processes the fragment on load,
  // so we just need to check whether a session exists.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        setSessionError(
          "Your password reset link is invalid or has expired. Please request a new one."
        );
      }
    });
  }, []);

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
      const result = await setPasswordAction(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Success — sign them out of the recovery session, then to login
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login?flash=password_reset");
    });
  };

  if (sessionError) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-md bg-danger/10 border border-danger/30">
          <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
          <p className="text-caption text-danger">{sessionError}</p>
        </div>
        <Button asChild variant="outline" className="w-full" size="lg">
          <a href="/reset-password">Request a new link</a>
        </Button>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <p className="text-body text-muted-foreground text-center py-6">
        Verifying your reset link…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
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
        {isPending ? "Updating…" : "Update password"}
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
