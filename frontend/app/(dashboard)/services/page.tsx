"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { selectors } from "@/lib/backend";
import { formatCurrency } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { Service } from "@/types/api";

export default function ServicesPage() {
  const { data, loading, error } = useApiQuery<{ success: boolean; services: Service[] }, Service[]>("/services", { select: selectors.services });

  if (loading) return <LoadingBlock label="Loading services..." />;
  if (error) return <ErrorBlock message={error} />;
  if (!data?.length) return <EmptyBlock title="No services" description="The backend returns services under the `services` key, and the list is currently empty." />;

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Services</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((service) => (
          <div key={service.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{service.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-400">{service.category || "uncategorized"}</p>
                <p className="mt-2 text-sm text-neutral-600">{service.description || "No description provided."}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${service.active === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{service.active === false ? "Inactive" : "Active"}</span>
            </div>
            <p className="mt-4 text-xl font-bold">{formatCurrency(service.price)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
