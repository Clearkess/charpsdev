"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminServicesQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Service } from "@/types/api";

export default function AdminServicesPage() {
  const { data, isPending, error } = useAdminServicesQuery();

  const columns = useMemo<ColumnDef<Service, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.slug || "no-slug"}</div>
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (row) => row.category ?? "",
        cell: ({ row }) => row.original.category || "—",
      },
      {
        id: "price",
        header: "Price",
        accessorFn: (row) => Number(row.price ?? 0),
        cell: ({ row }) => formatCurrency(row.original.price),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.active !== false,
        cell: ({ row }) => (
          <Badge variant={row.original.active === false ? "destructive" : "success"}>
            {row.original.active === false ? "Inactive" : "Active"}
          </Badge>
        ),
      },
      {
        id: "updated",
        header: "Updated",
        accessorFn: (row) => row.updated_at ?? "",
        cell: ({ row }) => formatDate(row.original.updated_at),
      },
    ],
    [],
  );

  if (isPending) return <TableSkeleton rows={5} cols={5} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />;
  if (!data?.length) return <EmptyBlock title="No services" description="No services have been created yet." />;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Services</h1>
      <Card>
        <CardContent>
          <DataTable columns={columns} data={data} />
        </CardContent>
      </Card>
    </section>
  );
}
