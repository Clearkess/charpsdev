import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-2 mb-6 text-sm text-neutral-600">Register a new marketplace account.</p>
        <RegisterForm />
      </div>
    </div>
  );
}
