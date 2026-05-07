"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "./actions";

export function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-md bg-success/10 border border-success/30">
          <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-body font-semibold text-foreground">
              Check your inbox
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              If an account exists for <strong>{email}</strong>, we&apos;ve
              sent a password reset link. It expires in 30 minutes.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="w-full" size="lg">
          <a href="/login">Back to sign in</a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center">
        <a
          href="/login"
          className="text-caption text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </a>
      </p>
    </form>
  );
}
