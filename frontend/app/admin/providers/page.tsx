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
  useAdminProviderHealthCheckMutation,
  useAdminProviderHealthSummaryQuery,
  useAdminProvidersQuery,
  useAdminProviderTestMutation,
  useAdminProviderUpdateMutation,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Provider, ProviderHealthStatus } from "@/types/api";

/** Provider Router (Option B): badge styling for the three health states. */
function healthBadgeVariant(status?: ProviderHealthStatus): "success" | "warning" | "destructive" | "muted" {
  switch (status) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "offline":
      return "destructive";
    default:
      return "muted";
  }
}

function healthLabel(status?: ProviderHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "offline":
      return "Offline";
    default:
      return "Unknown";
  }
}

export default function AdminProvidersPage() {
  const providers = useAdminProvidersQuery();
  const healthSummary = useAdminProviderHealthSummaryQuery();
  const createProvider = useAdminProviderCreateMutation();
  const updateProvider = useAdminProviderUpdateMutation();
  const deleteProvider = useAdminProviderDeleteMutation();
  const testProvider = useAdminProviderTestMutation();
  const healthCheckProvider = useAdminProviderHealthCheckMutation();

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

  const onTest = async (provider: Provider) => {
    setMessage(null);
    try {
      const result = await testProvider.mutateAsync(provider.id);
      const adapterNote = result.is_real_adapter ? "" : " (mock adapter — no real credentials configured yet)";
      setMessage(`${provider.name}: ${result.ok ? "reachable" : "unreachable"} — ${result.message}${adapterNote}`);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Connection test failed."));
    }
  };

  const onHealthCheck = async (provider: Provider) => {
    setMessage(null);
    try {
      const result = await healthCheckProvider.mutateAsync(provider.id);
      setMessage(result.message);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Health check failed."));
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
              <div className="text-xs text-muted-foreground">
                {provider.slug}
                {!provider.is_real_adapter ? (
                  <span className="ml-1.5 text-warning" title="No real adapter registered for this provider slug — orders route through the mock adapter.">
                    · mock adapter
                  </span>
                ) : null}
              </div>
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
        id: "health",
        header: "Health",
        accessorFn: (row) => row.health_status ?? "",
        cell: ({ row }) => {
          const provider = row.original;
          return (
            <div className="space-y-0.5">
              <Badge variant={healthBadgeVariant(provider.health_status)}>
                {healthLabel(provider.health_status)}
              </Badge>
              {provider.success_rate !== null && provider.success_rate !== undefined ? (
                <div className="text-xs text-muted-foreground">{provider.success_rate}% success</div>
              ) : (
                <div className="text-xs text-muted-foreground">No attempts yet</div>
              )}
              {provider.is_in_cooldown ? (
                <div className="text-xs text-muted-foreground">Cooling down</div>
              ) : null}
            </div>
          );
        },
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
          const isTesting = testProvider.isPending && testProvider.variables === provider.id;
          const isChecking = healthCheckProvider.isPending && healthCheckProvider.variables === provider.id;

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
              <Button size="sm" variant="outline" disabled={isTesting} onClick={() => void onTest(provider)}>
                {isTesting ? "Testing..." : "Test"}
              </Button>
              <Button size="sm" variant="outline" disabled={isChecking} onClick={() => void onHealthCheck(provider)}>
                {isChecking ? "Checking..." : "Health check"}
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
      testProvider.isPending,
      testProvider.variables,
      healthCheckProvider.isPending,
      healthCheckProvider.variables,
    ],
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Providers</h1>
      <p className="text-sm text-muted-foreground">
        Upstream service providers used to fulfil orders. API keys are stored securely and only ever shown masked.
        Per-service failover order is configured from each service&apos;s <span className="font-medium">Routing</span>{" "}
        action on the Services page.
      </p>

      {healthSummary.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Provider health</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-wrap gap-6">
              <div>
                <dt className="text-xs text-muted-foreground">Providers</dt>
                <dd className="text-2xl font-semibold">{healthSummary.data.total}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Healthy</dt>
                <dd className="text-2xl font-semibold text-success">{healthSummary.data.healthy}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Degraded</dt>
                <dd className="text-2xl font-semibold text-warning">{healthSummary.data.degraded}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Offline</dt>
                <dd className="text-2xl font-semibold text-destructive">{healthSummary.data.offline}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

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
        <TableSkeleton rows={5} cols={7} />
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
