"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInviteAction } from "./invite-action";
import type { UserRole } from "@/lib/types/database";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>("client");

  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("client");
    setError(null);
    setSuccessEmail(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessEmail(null);

    startTransition(async () => {
      const result = await createInviteAction({
        email,
        role,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessEmail(result.email);
      // Reset form fields but keep the success banner visible
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("client");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {successEmail && (
        <div className="flex items-start gap-3 p-3 rounded-md bg-success/10 border border-success/30">
          <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-caption text-foreground">
              Invitation sent to <strong>{successEmail}</strong>.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-1 text-caption text-success underline-offset-4 hover:underline"
            >
              Send another
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            type="text"
            disabled={isPending}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            type="text"
            disabled={isPending}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          disabled={isPending}
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="flex h-11 w-full rounded-md border border-input bg-card/40 px-4 py-2 text-body focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="client">Client</option>
          <option value="coach">Coach</option>
          <option value="admin">Admin</option>
        </select>
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
        size="lg"
        className="w-full"
        disabled={isPending || !email}
      >
        {isPending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
