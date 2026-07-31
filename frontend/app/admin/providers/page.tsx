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
  useAdminProviderCreateMutation,
  useAdminProviderDeleteMutation,
  useAdminProvidersQuery,
  useAdminProviderUpdateMutation,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Provider } from "@/types/api";

export default function AdminProvidersPage() {
  const providers = useAdminProvidersQuery();
  const createProvider = useAdminProviderCreateMutation();
  const updateProvider = useAdminProviderUpdateMutation();
  const deleteProvider = useAdminProviderDeleteMutation();

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Inline edit state: which provider row (if any) is currently being edited,
  // and a draft api_key value for it. Leaving the draft blank on save keeps
  // the provider's existing stored secret unchanged (backend behavior).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;
    setMessage(null);
    try {
      await createProvider.mutateAsync({
        name: name.trim(),
        base_url: baseUrl.trim(),
        api_key: apiKey.trim() || undefined,
      });
      setName("");
      setBaseUrl("");
      setApiKey("");
      setMessage("Provider created.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to create provider."));
    }
  };

  const startEdit = (provider: Provider) => {
    setEditingId(provider.id);
    setEditName(provider.name);
    setEditBaseUrl(provider.base_url);
    setEditApiKey("");
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditApiKey("");
  };

  const saveEdit = async (provider: Provider) => {
    setMessage(null);
    try {
      await updateProvider.mutateAsync({
        providerId: provider.id,
        name: editName.trim(),
        base_url: editBaseUrl.trim(),
        // Blank means "leave the stored secret unchanged" — enforced server-side too.
        api_key: editApiKey.trim() || undefined,
      });
      setEditingId(null);
      setEditApiKey("");
      setMessage("Provider updated.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to update provider."));
    }
  };

  const toggleActive = async (provider: Provider) => {
    setMessage(null);
    try {
      await updateProvider.mutateAsync({ providerId: provider.id, active: !provider.active });
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to update provider."));
    }
  };

  const onDelete = async (provider: Provider) => {
    setMessage(null);
    try {
      await deleteProvider.mutateAsync(provider.id);
      setMessage("Provider deleted.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to delete provider."));
    }
  };

  const columns = useMemo<ColumnDef<Provider, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.name,
        cell: ({ row }) => {
          const provider = row.original;
          if (editingId === provider.id) {
            return (
              <div className="space-y-1">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                <Input value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} placeholder="Base URL" />
                <Input
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="New API key (leave blank to keep current)"
                  type="password"
                />
              </div>
            );
          }
          return (
            <div>
              <div className="font-medium">{provider.name}</div>
              <div className="text-xs text-muted-foreground">{provider.slug}</div>
            </div>
          );
        },
      },
      {
        id: "base_url",
        header: "Base URL",
        accessorFn: (row) => row.base_url,
        cell: ({ row }) => (
          <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={row.original.base_url}>
            {row.original.base_url}
          </span>
        ),
      },
      {
        id: "api_key",
        header: "API Key",
        accessorFn: (row) => row.api_key_masked ?? "",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.has_api_key ? row.original.api_key_masked ?? "••••" : "Not set"}
          </span>
        ),
      },
      {
        id: "services",
        header: "Services",
        accessorFn: (row) => row.services_count ?? 0,
        cell: ({ row }) => row.original.services_count ?? 0,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => Boolean(row.active),
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "success" : "muted"}>
            {row.original.active ? "Active" : "Inactive"}
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
          const provider = row.original;
          const isBusy = updateProvider.isPending && updateProvider.variables?.providerId === provider.id;
          const isDeleting = deleteProvider.isPending && deleteProvider.variables === provider.id;

          if (editingId === provider.id) {
            return (
              <div className="flex gap-2">
                <Button size="sm" disabled={isBusy} onClick={() => void saveEdit(provider)}>
                  {isBusy ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(provider)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void toggleActive(provider)}>
                {isBusy ? "Working..." : provider.active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeleting}
                className="text-destructive hover:bg-destructive/10"
                onClick={() => void onDelete(provider)}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      editingId,
      editName,
      editBaseUrl,
      editApiKey,
      updateProvider.isPending,
      updateProvider.variables,
      deleteProvider.isPending,
      deleteProvider.variables,
    ],
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Providers</h1>
      <p className="text-sm text-muted-foreground">
        Upstream service providers used to fulfil orders. API keys are stored securely and only ever shown masked.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Add provider</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="text-xs text-muted-foreground" htmlFor="provider-name">Name</label>
              <Input id="provider-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SMM Panel Pro" />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="text-xs text-muted-foreground" htmlFor="provider-url">Base URL</label>
              <Input id="provider-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.provider.com" />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="text-xs text-muted-foreground" htmlFor="provider-key">API Key</label>
              <Input
                id="provider-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button type="submit" disabled={createProvider.isPending || !name.trim() || !baseUrl.trim()}>
              {createProvider.isPending ? "Creating..." : "Add provider"}
            </Button>
          </form>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {providers.isPending ? (
        <TableSkeleton rows={5} cols={6} />
      ) : providers.error ? (
        <ErrorBlock message={extractErrorMessage(providers.error, "Failed to load providers.")} />
      ) : !providers.data?.length ? (
        <EmptyBlock title="No providers" description="Add your first provider above." />
      ) : (
        <Card>
          <CardContent>
            <DataTable columns={columns} data={providers.data} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
