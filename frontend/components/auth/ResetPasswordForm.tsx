"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMessage, useResetPasswordMutation } from "@/hooks/queries/useAuthQueries";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const resetPassword = useResetPasswordMutation();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    try {
      const message = await resetPassword.mutateAsync({
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      setStatus(message);
    } catch (error) {
      setStatus(extractErrorMessage(error, "Could not reset password."));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="email" required />
      <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Reset token" required />
      <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="New password" autoComplete="new-password" required />
      <Input value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} type="password" placeholder="Confirm new password" autoComplete="new-password" required />
      {status ? <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{status}</p> : null}
      <Button type="submit" disabled={resetPassword.isPending} className="w-full" size="lg">
        <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
        {resetPassword.isPending ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
