import RegisterForm from "@/components/auth/RegisterForm";
import BrandMark from "@/components/common/BrandMark";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <BrandMark className="h-8 w-auto" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Create account</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Register a new marketplace account.</p>
        <RegisterForm />
      </div>
    </div>
  );
}
