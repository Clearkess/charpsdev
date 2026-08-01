import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import BrandMark from "@/components/common/BrandMark";

function ResetPasswordPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <BrandMark className="h-8 w-auto" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Reset password</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Use the token sent by the API.</p>
        <ResetPasswordForm />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reset form...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
