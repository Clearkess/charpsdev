import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

function LoginPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 mb-6 text-sm text-neutral-600">Sign in to access your CharpsDev dashboard.</p>
        <LoginForm />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-500">Loading login form...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
