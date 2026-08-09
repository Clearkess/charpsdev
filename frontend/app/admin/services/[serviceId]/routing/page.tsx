"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import {
  useAdminServiceProviderCreateMutation,
  useAdminServiceProviderDeleteMutation,
  useAdminServiceProviderReorderMutation,
  useAdminServiceProvidersQuery,
  useAdminServiceProviderUpdateMutation,
  useAdminServicesQuery,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import type { ProviderHealthStatus, ServiceProviderRoute } from "@/types/api";

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

/**
 * Provider Router (Option B) — the per-service "Routing editor" from the
 * original proposal's mockup (e.g. "MTN 1GB" listing providers with
 * PRIMARY/BACKUP labels, Enabled toggle, Priority input, "+ Add provider",
 * reorder controls, "Save routing"). Built as its own nested route rather
 * than a modal on the Services page since there's no Dialog primitive in
 * this design system yet (components/ui has no dialog/modal component) —
 * consistent with every other admin drill-down being its own page.
 *
 * Reordering here uses explicit Move up/down buttons rather than pointer
 * drag-and-drop: no drag-and-drop library (dnd-kit or similar) is a
 * dependency of this project yet, and up/down buttons hit the exact same
 * POST .../reorder endpoint a drag implementation would, so a real
 * drag-to-reorder UI can be layered on top later (swap the buttons for a
 * dnd-kit sortable list; the mutation and payload shape stay identical).
 */
export default function AdminServiceRoutingPage() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = Number(params.serviceId);

  const services = useAdminServicesQuery();
  const routes = useAdminServiceProvidersQuery(serviceId);
  const createRoute = useAdminServiceProviderCreateMutation(serviceId);
  const updateRoute = useAdminServiceProviderUpdateMutation(serviceId);
  const deleteRoute = useAdminServiceProviderDeleteMutation(serviceId);
  const reorderRoutes = useAdminServiceProviderReorderMutation(serviceId);

  const [message, setMessage] = useState<string | null>(null);
  const [newProviderId, setNewProviderId] = useState("");

  const service = useMemo(() => services.data?.find((s) => s.id === serviceId), [services.data, serviceId]);

  // Providers not already in this service's chain, for the "+ Add
  // provider" picker (a plain <select> — no separate providers list fetch
  // needed here since AdminNav's Providers page already keeps that query
  // warm in the cache most of the time; if it's not cached this still
  // works, just shows nothing to pick until that page has been visited).
  const orderedRoutes = routes.data ?? [];

  const onAddProvider = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProviderId) return;
    setMessage(null);
    try {
      await createRoute.mutateAsync({ provider_id: Number(newProviderId) });
      setNewProviderId("");
      setMessage("Provider added to routing chain.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to add provider."));
    }
  };

  const onToggleEnabled = async (route: ServiceProviderRoute) => {
    setMessage(null);
    try {
      await updateRoute.mutateAsync({ routeId: route.id, enabled: !route.enabled });
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to update routing entry."));
    }
  };

  const onRemove = async (route: ServiceProviderRoute) => {
    setMessage(null);
    try {
      await deleteRoute.mutateAsync(route.id);
      setMessage("Provider removed from routing chain.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to remove provider."));
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedRoutes.length) return;

    const reordered = [...orderedRoutes];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setMessage(null);
    try {
      await reorderRoutes.mutateAsync(reordered.map((route) => route.id));
      setMessage("Routing order saved.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to save routing order."));
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/services"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          Services
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-3xl font-bold">
          Routing{service ? `: ${service.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ordered provider failover chain for this service. Position 1 is tried first (PRIMARY); every entry below
          it is a BACKUP, tried in order only if the ones above it fail with a retryable error.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add provider</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAddProvider} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className="text-xs text-muted-foreground" htmlFor="route-provider-id">Provider ID</label>
              <Input
                id="route-provider-id"
                type="number"
                min="1"
                value={newProviderId}
                onChange={(e) => setNewProviderId(e.target.value)}
                placeholder="See the Providers page for IDs"
              />
            </div>
            <Button type="submit" disabled={createRoute.isPending || !newProviderId}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {createRoute.isPending ? "Adding..." : "Add provider"}
            </Button>
            <Link href="/admin/providers" className="text-xs text-muted-foreground underline">
              View provider IDs
            </Link>
          </form>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {routes.isPending ? (
        <TableSkeleton rows={3} cols={5} />
      ) : routes.error ? (
        <ErrorBlock message={extractErrorMessage(routes.error, "Failed to load routing chain.")} />
      ) : !orderedRoutes.length ? (
        <EmptyBlock
          title="No providers routed"
          description="This service has no routing chain configured yet — checkout falls back to legacy unrouted behaviour. Add a provider above to enable automatic failover."
        />
      ) : (
        <div className="space-y-3">
          {orderedRoutes.map((route, index) => (
            <Card key={route.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0 || reorderRoutes.isPending}
                    onClick={() => void move(index, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === orderedRoutes.length - 1 || reorderRoutes.isPending}
                    onClick={() => void move(index, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </Button>
                </div>

                <Badge variant={route.role === "primary" ? "default" : "secondary"}>
                  {route.role === "primary" ? "PRIMARY" : `BACKUP #${index}`}
                </Badge>

                <div className="min-w-[160px] flex-1">
                  <div className="font-medium">{route.provider?.name ?? `Provider #${route.provider_id}`}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={healthBadgeVariant(route.provider?.health_status)}>
                      {route.provider?.health_status ?? "unknown"}
                    </Badge>
                    {route.success_rate !== null ? <span>{route.success_rate}% success on this route</span> : <span>No attempts yet</span>}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">Priority: {route.priority}</div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateRoute.isPending && updateRoute.variables?.routeId === route.id}
                  onClick={() => void onToggleEnabled(route)}
                >
                  {route.enabled ? "Enabled" : "Disabled"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={deleteRoute.isPending && deleteRoute.variables === route.id}
                  onClick={() => void onRemove(route)}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
