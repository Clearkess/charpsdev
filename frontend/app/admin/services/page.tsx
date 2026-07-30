"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import {
  useAdminCategoriesQuery,
  useAdminServiceCreateMutation,
  useAdminServiceDeleteMutation,
  useAdminServicesQuery,
  useAdminServiceUpdateMutation,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Service } from "@/types/api";

export default function AdminServicesPage() {
  const { data, isPending, error } = useAdminServicesQuery();
  const categories = useAdminCategoriesQuery();
  const createService = useAdminServiceCreateMutation();
  const updateService = useAdminServiceUpdateMutation();
  const deleteService = useAdminServiceDeleteMutation();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !price) return;
    setMessage(null);
    try {
      await createService.mutateAsync({
        name: name.trim(),
        category_id: categoryId ? Number(categoryId) : null,
        price: Number(price),
        stock: stock ? Number(stock) : null,
      });
      setName("");
      setPrice("");
      setStock("");
      setMessage("Service created.");
    } catch (err) {
      setMessage(extractErrorMessage(err, "Failed to create service."));
    }
  };

  const toggleActive = async (service: Service) => {
    setMessage(null);
    try {
      await updateService.mutateAsync({ serviceId: service.id, active: !(service.active !== false) });
    } catch (err) {
      setMessage(extractErrorMessage(err, "Failed to update service."));
    }
  };

  const onDelete = async (service: Service) => {
    setMessage(null);
    try {
      await deleteService.mutateAsync(service.id);
      setMessage("Service deleted.");
    } catch (err) {
      setMessage(extractErrorMessage(err, "Failed to delete service."));
    }
  };

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
        accessorFn: (row) => row.category_group?.name ?? row.category ?? "",
        cell: ({ row }) => row.original.category_group?.name || row.original.category || "—",
      },
      {
        id: "price",
        header: "Price",
        accessorFn: (row) => Number(row.price ?? 0),
        cell: ({ row }) => formatCurrency(row.original.price, row.original.currency),
      },
      {
        id: "stock",
        header: "Stock",
        accessorFn: (row) => (row.stock == null ? -1 : row.stock),
        cell: ({ row }) => (row.original.stock == null ? "Unlimited" : row.original.stock),
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
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const service = row.original;
          const isBusy = updateService.isPending && updateService.variables?.serviceId === service.id;
          const isDeleting = deleteService.isPending && deleteService.variables === service.id;
          return (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void toggleActive(service)}>
                {isBusy ? "Working..." : service.active === false ? "Activate" : "Deactivate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeleting}
                className="text-destructive hover:bg-destructive/10"
                onClick={() => void onDelete(service)}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateService.isPending, updateService.variables, deleteService.isPending, deleteService.variables],
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Services</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create service</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="text-xs text-muted-foreground" htmlFor="service-name">Name</label>
              <Input id="service-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix Premium - 1 Month" />
            </div>
            <div className="w-48">
              <label className="text-xs text-muted-foreground" htmlFor="service-category">Category</label>
              <select
                id="service-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">Uncategorized</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground" htmlFor="service-price">Price</label>
              <Input id="service-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground" htmlFor="service-stock">Stock</label>
              <Input id="service-stock" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Unlimited" />
            </div>
            <Button type="submit" disabled={createService.isPending || !name.trim() || !price}>
              {createService.isPending ? "Creating..." : "Add service"}
            </Button>
          </form>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {isPending ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />
      ) : !data?.length ? (
        <EmptyBlock title="No services" description="No services have been created yet." />
      ) : (
        <Card>
          <CardContent>
            <DataTable columns={columns} data={data} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
