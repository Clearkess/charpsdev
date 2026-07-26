"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await api.post("/reset-password", {
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      setStatus(response.data?.message || "Password reset complete.");
    } catch {
      setStatus("Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required />
      <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Reset token" required />
      <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="New password" required />
      <Input value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} type="password" placeholder="Confirm new password" required />
      {status ? <p className="text-sm text-neutral-600">{status}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Resetting..." : "Reset password"}</Button>
    </form>
  );
}
