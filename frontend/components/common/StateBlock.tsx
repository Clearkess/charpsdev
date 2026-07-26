export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded-2xl bg-white p-6 text-sm text-neutral-500 shadow-sm ring-1 ring-black/5">{label}</div>;
}

export function ErrorBlock({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{message}</div>;
}

export function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-neutral-600">{description}</p>
    </div>
  );
}
