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
  useAdminCategoryCreateMutation,
  useAdminCategoryDeleteMutation,
  useAdminCategoryUpdateMutation,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Category } from "@/types/api";

export default function AdminCategoriesPage() {
  const categories = useAdminCategoriesQuery();
  const createCategory = useAdminCategoryCreateMutation();
  const updateCategory = useAdminCategoryUpdateMutation();
  const deleteCategory = useAdminCategoryDeleteMutation();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setMessage(null);
    try {
      await createCategory.mutateAsync({ name: name.trim(), icon: icon.trim() || undefined });
      setName("");
      setIcon("");
      setMessage("Category created.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to create category."));
    }
  };

  const toggleStatus = async (category: Category) => {
    setMessage(null);
    try {
      await updateCategory.mutateAsync({ categoryId: category.id, status: !category.status });
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to update category."));
    }
  };

  const onDelete = async (category: Category) => {
    setMessage(null);
    try {
      await deleteCategory.mutateAsync(category.id);
      setMessage("Category deleted.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to delete category."));
    }
  };

  const columns = useMemo<ColumnDef<Category, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.slug}</div>
          </div>
        ),
      },
      {
        id: "services",
        header: "Services",
        accessorFn: (row) => row.services_count ?? row.active_services_count ?? 0,
        cell: ({ row }) => row.original.services_count ?? row.original.active_services_count ?? 0,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => Boolean(row.status),
        cell: ({ row }) => (
          <Badge variant={row.original.status ? "success" : "muted"}>
            {row.original.status ? "Active" : "Hidden"}
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
          const category = row.original;
          const isBusy = updateCategory.isPending && updateCategory.variables?.categoryId === category.id;
          const isDeleting = deleteCategory.isPending && deleteCategory.variables === category.id;
          return (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void toggleStatus(category)}>
                {isBusy ? "Working..." : category.status ? "Hide" : "Show"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeleting}
                className="text-destructive hover:bg-destructive/10"
                onClick={() => void onDelete(category)}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateCategory.isPending, updateCategory.variables, deleteCategory.isPending, deleteCategory.variables],
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Categories</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground" htmlFor="category-name">Name</label>
              <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Facebook Accounts" />
            </div>
            <div className="w-40">
              <label className="text-xs text-muted-foreground" htmlFor="category-icon">Icon (optional)</label>
              <Input id="category-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. facebook" />
            </div>
            <Button type="submit" disabled={createCategory.isPending || !name.trim()}>
              {createCategory.isPending ? "Creating..." : "Add category"}
            </Button>
          </form>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {categories.isPending ? (
        <TableSkeleton rows={5} cols={5} />
      ) : categories.error ? (
        <ErrorBlock message={extractErrorMessage(categories.error, "Failed to load categories.")} />
      ) : !categories.data?.length ? (
        <EmptyBlock title="No categories" description="Create your first category above." />
      ) : (
        <Card>
          <CardContent>
            <DataTable columns={columns} data={categories.data} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
