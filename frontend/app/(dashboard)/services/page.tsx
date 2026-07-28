"use client";

import { PackageSearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";

export default function ServicesPage() {
  const { data, isPending, error } = useServicesQuery();
  const searchTerm = useUiStore((state) => state.serviceSearchTerm);
  const setServiceSearchTerm = useUiStore((state) => state.setServiceSearchTerm);
  const clearSearch = () => setServiceSearchTerm("");

  if (isPending) return <TableSkeleton rows={4} cols={3} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />;
  if (!data?.length) {
    return (
      <EmptyBlock
        title="No services yet"
        description="There are currently no services available in the marketplace. Check back soon, or contact an admin to add the first one."
        icon={PackageSearchIcon}
      />
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = normalizedSearch
    ? data.filter((service) =>
        [service.name, service.category, service.description]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(normalizedSearch)),
      )
    : data;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Services</h1>
      {normalizedSearch ? (
        <p className="text-sm text-muted-foreground">
          {filtered.length} result{filtered.length === 1 ? "" : "s"} for &ldquo;{searchTerm}&rdquo;
        </p>
      ) : null}
      {!filtered.length ? (
        <EmptyBlock
          title="No matching services"
          description={`No services matched "${searchTerm}". Try a different search term.`}
          icon={PackageSearchIcon}
          action={
            <Button variant="outline" size="sm" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((service) => (
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
      )}
    </section>
  );
}
