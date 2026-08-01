import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import BrandMark from "@/components/common/BrandMark";

function LoginPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <BrandMark className="h-8 w-auto" />
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
