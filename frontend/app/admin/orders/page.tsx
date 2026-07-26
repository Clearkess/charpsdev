export default function AdminOrdersPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Admin · Orders</h1>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">Backend limitation detected</p>
        <p className="mt-2 text-sm">
          The route file declares only <code>GET /admin/orders/{'{order}'}</code> and <code>PUT /admin/orders/{'{order}'}</code>,
          and the current <code>AdminOrderController</code> is empty. There is no list endpoint to wire here yet, and detail/update handlers are not implemented server-side.
        </p>
      </div>
    </section>
  );
}
