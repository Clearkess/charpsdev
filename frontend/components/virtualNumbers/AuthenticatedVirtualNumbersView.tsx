"use client";

/**
 * The full country/service-selection + rental experience for logged-in
 * users. Extracted verbatim from the former
 * app/(dashboard)/virtual-numbers/page.tsx so app/virtual-numbers/page.tsx
 * can render this for authenticated visitors while rendering a separate,
 * lighter public teaser (see PublicVirtualNumbersView.tsx) for anonymous
 * visitors/crawlers at the same `/virtual-numbers` URL (Top-3-Fixes, Fix 2).
 */

import { useMemo, useState } from "react";
import {
  CopyIcon,
  Loader2Icon,
  PhoneIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import {
  useBuyVirtualNumberMutation,
  useCancelVirtualNumberMutation,
  usePollVirtualNumberMutation,
  useVirtualCountriesQuery,
  useVirtualNumberOrdersQuery,
  useVirtualProvidersQuery,
  useVirtualServicesQuery,
} from "@/hooks/queries/useVirtualNumberQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { VirtualNumberOrder, VirtualNumberOrderStatus } from "@/types/api";

const STATUS_META: Record<VirtualNumberOrderStatus, { label: string; variant: "default" | "warning" | "success" | "destructive" | "muted" }> = {
  pending: { label: "Processing…", variant: "muted" },
  waiting_code: { label: "Waiting for code", variant: "warning" },
  received: { label: "Code received", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
  expired: { label: "Expired", variant: "destructive" },
  refunded: { label: "Refunded", variant: "muted" },
  failed: { label: "Failed", variant: "destructive" },
};

const ACTIVE_STATUSES: VirtualNumberOrderStatus[] = ["pending", "waiting_code"];

/** Horizontally-scrolling provider tabs — same visual pattern as Services' CategoryChips. Provider-scoped browsing: each provider's countries/services below are that provider's own, never mixed. */
function ProviderTabs({
  providers,
  selected,
  onSelect,
}: {
  providers: Array<{ slug: string; name: string }>;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:px-0">
      {providers.map((provider) => (
        <Button
          key={provider.slug}
          variant={selected === provider.slug ? "default" : "outline"}
          size="sm"
          className="shrink-0 rounded-full"
          onClick={() => onSelect(provider.slug)}
        >
          {provider.name}
        </Button>
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: VirtualNumberOrder }) {
  const poll = usePollVirtualNumberMutation();
  const cancel = useCancelVirtualNumberMutation();
  const [error, setError] = useState<string | null>(null);
  const isActive = ACTIVE_STATUSES.includes(order.status);
  const meta = STATUS_META[order.status] ?? { label: order.status, variant: "muted" as const };

  const onPoll = async () => {
    setError(null);
    try {
      const updated = await poll.mutateAsync(order.id);
      if (updated.status === "received") notify.success("SMS code received!", `Code for ${updated.service_name ?? updated.service_code}`);
      else if (updated.status === "refunded") notify.info("No code arrived", "This order was refunded to your wallet.");
    } catch (err) {
      setError(extractErrorMessage(err, "Could not refresh this order."));
    }
  };

  const onCancel = async () => {
    setError(null);
    try {
      await cancel.mutateAsync(order.id);
      notify.info("Order cancelled", "Refunded to your wallet.");
    } catch (err) {
      setError(extractErrorMessage(err, "Could not cancel this order."));
    }
  };

  const copyPhone = () => {
    if (!order.phone_number) return;
    void navigator.clipboard.writeText(order.phone_number);
    notify.success("Copied", order.phone_number);
  };

  const copyCode = () => {
    if (!order.sms_code) return;
    void navigator.clipboard.writeText(order.sms_code);
    notify.success("Copied", order.sms_code);
  };

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{order.service_name ?? order.service_code}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {order.provider_slug} · {order.country}
            </p>
          </div>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        {order.phone_number ? (
          <button
            type="button"
            onClick={copyPhone}
            className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left transition-colors hover:bg-muted/70"
          >
            <span className="font-mono text-sm">{order.phone_number}</span>
            <CopyIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
        ) : null}

        {order.sms_code ? (
          <button
            type="button"
            onClick={copyCode}
            className="flex w-full items-center justify-between gap-2 rounded-lg bg-success/10 px-3 py-2 text-left transition-colors hover:bg-success/20"
          >
            <span className="font-mono text-base font-semibold text-success">{order.sms_code}</span>
            <CopyIcon className="size-3.5 text-success" aria-hidden="true" />
          </button>
        ) : order.sms_text ? (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{order.sms_text}</p>
        ) : null}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(order.price_ngn, order.currency)}</span>
          <span>{formatDate(order.created_at)}</span>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {isActive ? (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" disabled={poll.isPending} onClick={onPoll}>
              {poll.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/10"
              disabled={cancel.isPending}
              onClick={onCancel}
            >
              <XIcon className="size-3.5" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AuthenticatedVirtualNumbersView() {
  const providers = useVirtualProvidersQuery();
  const [providerSlug, setProviderSlug] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [serviceCode, setServiceCode] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [buyError, setBuyError] = useState<string | null>(null);

  const countries = useVirtualCountriesQuery(providerSlug);
  const services = useVirtualServicesQuery(providerSlug, country);
  const orders = useVirtualNumberOrdersQuery();
  const buy = useBuyVirtualNumberMutation();

  const activeProvider = providers.data?.find((p) => p.slug === providerSlug) ?? providers.data?.[0] ?? null;
  const effectiveProviderSlug = providerSlug ?? activeProvider?.slug ?? null;

  const filteredServices = useMemo(() => {
    const list = services.data ?? [];
    const term = serviceSearch.trim().toLowerCase();
    const available = list.filter((service) => service.count > 0);
    if (!term) return available;
    return available.filter((service) => service.name.toLowerCase().includes(term));
  }, [services.data, serviceSearch]);

  const selectedService = filteredServices.find((s) => s.code === serviceCode) ?? services.data?.find((s) => s.code === serviceCode);

  const onSelectProvider = (slug: string) => {
    setProviderSlug(slug);
    setCountry(null);
    setServiceCode(null);
    setServiceSearch("");
  };

  const onSelectCountry = (value: string) => {
    setCountry(value || null);
    setServiceCode(null);
  };

  const onBuy = async () => {
    if (!effectiveProviderSlug || !country || !serviceCode) return;
    setBuyError(null);
    try {
      const order = await buy.mutateAsync({ provider: effectiveProviderSlug, country, service: serviceCode });
      notify.success("Number rented!", `${order.phone_number ?? "Your number"} is ready — waiting for the SMS code.`);
      setServiceCode(null);
    } catch (err) {
      setBuyError(extractErrorMessage(err, "Could not rent a number."));
    }
  };

  const activeOrders = (orders.data?.data ?? []).filter((order) => ACTIVE_STATUSES.includes(order.status));
  const pastOrders = (orders.data?.data ?? []).filter((order) => !ACTIVE_STATUSES.includes(order.status));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Virtual Numbers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rent a real number to receive an SMS verification code from any service — pay from your wallet.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-5">
          {providers.isPending ? (
            <TableSkeleton rows={1} cols={3} />
          ) : providers.error ? (
            <ErrorBlock message={extractErrorMessage(providers.error, "Failed to load providers.")} />
          ) : !providers.data?.length ? (
            <EmptyBlock
              title="No providers configured"
              description="Virtual number providers haven't been set up yet. Please check back soon."
              icon={PhoneIcon}
            />
          ) : (
            <>
              <ProviderTabs providers={providers.data} selected={effectiveProviderSlug} onSelect={onSelectProvider} />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Country</span>
                  <select
                    value={country ?? ""}
                    onChange={(event) => onSelectCountry(event.target.value)}
                    disabled={countries.isPending || !countries.data?.length}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{countries.isPending ? "Loading countries…" : "Select a country"}</option>
                    {countries.data?.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Service</span>
                  <select
                    value={serviceCode ?? ""}
                    onChange={(event) => setServiceCode(event.target.value || null)}
                    disabled={!country || services.isPending || !filteredServices.length}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">
                      {!country ? "Select a country first" : services.isPending ? "Loading services…" : "Select a service"}
                    </option>
                    {filteredServices.map((service) => (
                      <option key={service.code} value={service.code}>
                        {service.name} — ${service.cost_usd.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {country ? (
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                    type="search"
                    placeholder="Filter services (e.g. WhatsApp, Telegram)…"
                    aria-label="Filter services"
                    className="h-9 rounded-full pl-9"
                  />
                </div>
              ) : null}

              {services.error ? <ErrorBlock message={extractErrorMessage(services.error, "Failed to load services.")} /> : null}

              {selectedService ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/15">
                  <div>
                    <p className="font-medium">{selectedService.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ≈ ${selectedService.cost_usd.toFixed(2)} + markup, converted to NGN at checkout · {selectedService.count} available
                    </p>
                  </div>
                  <Button onClick={onBuy} disabled={buy.isPending}>
                    {buy.isPending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : <PhoneIcon className="size-4" aria-hidden="true" />}
                    Rent number
                  </Button>
                </div>
              ) : null}

              {buyError ? <p className="text-sm text-destructive">{buyError}</p> : null}
            </>
          )}
        </CardContent>
      </Card>

      {activeOrders.length ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Active</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">History</h2>
        {orders.isPending ? (
          <TableSkeleton rows={3} cols={3} />
        ) : orders.error ? (
          <ErrorBlock message={extractErrorMessage(orders.error, "Failed to load orders.")} />
        ) : !pastOrders.length ? (
          <EmptyBlock
            title="No past orders"
            description="Rented numbers you've finished, cancelled, or that expired will show up here."
            icon={PhoneIcon}
          />
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3")}>
            {pastOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
