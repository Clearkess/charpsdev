import RegisterForm from "@/components/auth/RegisterForm";
import { APP_NAME } from "@/lib/constants";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading text-sm font-bold">
            {APP_NAME.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-heading text-lg font-semibold">{APP_NAME}</span>
        </div>
        <h1 className="font-heading text-2xl font-bold">Create account</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Register a new marketplace account.</p>
        <RegisterForm />
      </div>
    </div>
  );
}
