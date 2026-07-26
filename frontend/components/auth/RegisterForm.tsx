"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

export default function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(form.name, form.email, form.password, form.password_confirmation);
      router.push("/dashboard");
    } catch {
      setError("Registration failed. Verify API validation rules and backend email setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Name</label>
        <Input value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Jane Doe" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <Input type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder="you@example.com" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Password</label>
        <Input type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} placeholder="Minimum 8 characters" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirm password</label>
        <Input type="password" value={form.password_confirmation} onChange={(e) => onChange("password_confirmation", e.target.value)} required />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating account..." : "Register"}
      </Button>
      <p className="text-sm text-neutral-600">
        Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
      </p>
    </form>
  );
}
