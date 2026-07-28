"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { extractErrorMessage } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.push(searchParams.get("next") || "/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to sign in. Check your credentials and try again."));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-foreground">
          Password
        </label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isLoggingIn} className="w-full" size="lg">
        <LogInIcon data-icon="inline-start" aria-hidden="true" />
        {isLoggingIn ? "Signing in..." : "Login"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot password
        </Link>
        <Link href="/register" className="text-primary hover:underline">
          Create account
        </Link>
      </div>
    </form>
  );
}
