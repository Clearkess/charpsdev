"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await api.post("/forgot-password", { email });
      setStatus(response.data?.message || "Password reset link request sent.");
    } catch {
      setStatus("Could not request a reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </div>
      {status ? <p className="text-sm text-neutral-600">{status}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Submitting..." : "Send reset link"}</Button>
    </form>
  );
}
