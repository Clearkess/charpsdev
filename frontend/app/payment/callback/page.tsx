import { InfoIcon } from "lucide-react";

export default function PaymentCallbackPage() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-heading text-2xl font-bold">Payment callback</h1>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          This placeholder page exists so the payment gateway can return users to the frontend.
          In a production build, this page should inspect the reference and call the verify endpoint safely.
        </p>
      </div>
    </div>
  );
}
