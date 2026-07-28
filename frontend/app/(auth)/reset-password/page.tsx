import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { APP_NAME } from "@/lib/constants";

function ResetPasswordPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading text-sm font-bold">
            {APP_NAME.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-heading text-lg font-semibold">{APP_NAME}</span>
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
