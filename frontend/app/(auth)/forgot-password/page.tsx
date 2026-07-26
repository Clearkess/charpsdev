import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 mb-6 text-sm text-neutral-600">Request a reset link from the backend API.</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
