import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

function ResetPasswordPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="mt-2 mb-6 text-sm text-neutral-600">Use the token sent by the API.</p>
        <ResetPasswordForm />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-500">Loading reset form...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
