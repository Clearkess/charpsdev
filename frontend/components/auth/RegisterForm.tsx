"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { extractErrorMessage } from "@/lib/api";

export default function RegisterForm() {
  const router = useRouter();
  const { register, isRegistering } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [error, setError] = useState<string | null>(null);

  const onChange = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await register(form.name, form.email, form.password, form.password_confirmation);
      router.push("/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err, "Registration failed. Please verify your details and try again."));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="register-name" className="mb-1.5 block text-sm font-medium text-foreground">
          Name
        </label>
        <Input id="register-name" value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Jane Doe" autoComplete="name" required />
      </div>
      <div>
        <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-foreground">
          Email
        </label>
        <Input id="register-email" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div>
        <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-foreground">
          Password
        </label>
        <Input id="register-password" type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" required />
      </div>
      <div>
        <label htmlFor="register-password-confirmation" className="mb-1.5 block text-sm font-medium text-foreground">
          Confirm password
        </label>
        <Input id="register-password-confirmation" type="password" value={form.password_confirmation} onChange={(e) => onChange("password_confirmation", e.target.value)} autoComplete="new-password" required />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isRegistering} className="w-full" size="lg">
        <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
        {isRegistering ? "Creating account..." : "Register"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Login
        </Link>
      </p>
    </form>
  );
}
