"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export default function ServicesPage() {
  const { data, isPending, error } = useServicesQuery();

  if (isPending) return <TableSkeleton rows={4} cols={3} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />;
  if (!data?.length) {
    return <EmptyBlock title="No services" description="There are currently no services available in the marketplace." />;
  }

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Services</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((service) => (
          <Card key={service.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{service.name}</h2>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {service.category || "uncategorized"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{service.description || "No description provided."}</p>
                </div>
                <Badge variant={service.active === false ? "destructive" : "success"}>
                  {service.active === false ? "Inactive" : "Active"}
                </Badge>
              </div>
              <p className="mt-4 text-xl font-bold">{formatCurrency(service.price)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
