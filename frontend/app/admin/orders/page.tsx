import { TriangleAlertIcon } from "lucide-react";

export default function AdminOrdersPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Orders</h1>
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-6 text-warning">
        <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Backend limitation detected</p>
          <p className="mt-2 text-sm">
            The route file declares only <code>GET /admin/orders/{"{order}"}</code> and{" "}
            <code>PUT /admin/orders/{"{order}"}</code>, and the current <code>AdminOrderController</code> is empty.
            There is no list endpoint to wire here yet, and detail/update handlers are not implemented server-side.
          </p>
        </div>
      </div>
    </section>
  );
}
