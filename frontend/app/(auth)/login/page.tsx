import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import { APP_NAME } from "@/lib/constants";

function LoginPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading text-sm font-bold">
            {APP_NAME.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-heading text-lg font-semibold">{APP_NAME}</span>
        </div>
        <h1 className="font-heading text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Sign in to access your dashboard.</p>
        <LoginForm />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading login form...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
