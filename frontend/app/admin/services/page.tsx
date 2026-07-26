"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { selectors } from "@/lib/backend";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { Service } from "@/types/api";

export default function AdminServicesPage() {
  const { data, loading, error } = useApiQuery<{ success: boolean; services: Service[] }, Service[]>("/admin/services", { select: selectors.adminServices });

  if (loading) return <LoadingBlock label="Loading admin services..." />;
  if (error) return <ErrorBlock message={error} />;
  if (!data?.length) return <EmptyBlock title="No services" description="The admin services endpoint returned an empty `services` array." />;

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Admin · Services</h1>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-neutral-500"><tr><th className="px-2 py-3">Name</th><th className="px-2 py-3">Category</th><th className="px-2 py-3">Price</th><th className="px-2 py-3">Active</th><th className="px-2 py-3">Updated</th></tr></thead>
            <tbody>
              {data.map((service) => (
                <tr key={service.id} className="border-b last:border-b-0">
                  <td className="px-2 py-3"><div className="font-medium">{service.name}</div><div className="text-xs text-neutral-500">{service.slug || "no-slug"}</div></td>
                  <td className="px-2 py-3">{service.category || "—"}</td>
                  <td className="px-2 py-3">{formatCurrency(service.price)}</td>
                  <td className="px-2 py-3">{service.active === false ? "No" : "Yes"}</td>
                  <td className="px-2 py-3">{formatDate(service.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
