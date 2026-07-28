"use client";

import { useState } from "react";
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMessage, useForgotPasswordMutation } from "@/hooks/queries/useAuthQueries";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const forgotPassword = useForgotPasswordMutation();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    try {
      const message = await forgotPassword.mutateAsync(email);
      setStatus(message);
    } catch (error) {
      setStatus(extractErrorMessage(error, "Could not request a reset link."));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      {status ? <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{status}</p> : null}
      <Button type="submit" disabled={forgotPassword.isPending} className="w-full" size="lg">
        <MailIcon data-icon="inline-start" aria-hidden="true" />
        {forgotPassword.isPending ? "Submitting..." : "Send reset link"}
      </Button>
    </form>
  );
}
