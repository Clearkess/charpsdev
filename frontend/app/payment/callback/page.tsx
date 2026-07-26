export default function PaymentCallbackPage() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Payment callback</h1>
      <p className="mt-3 text-neutral-600">
        This placeholder page exists so the payment gateway can return users to the frontend.
        In a production build, this page should inspect the reference and call the verify endpoint safely.
      </p>
    </div>
  );
}
