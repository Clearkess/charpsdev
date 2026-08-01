import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import BrandMark from "@/components/common/BrandMark";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <BrandMark className="h-8 w-auto" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Request a reset link from the backend API.</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
