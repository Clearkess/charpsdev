"use client";

import Link from "next/link";
import { ArrowRightIcon, LogInIcon, PackageSearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getCategoryIcon, getServiceIcon, hasVariablePricing } from "@/lib/serviceIcons";
import type { Category, Service } from "@/types/api";

/**
 * Public, SEO-indexable services catalogue rendered for anonymous visitors
 * and crawlers (Top-3-Fixes, Fix 2). Reads from the same now-public
 * `GET /services` / `GET /categories` endpoints as the authenticated view
 * (useServicesQuery / useCategoriesQuery — see backend routes/api.php,
 * commit fd91d29), so the catalogue content itself is always in sync with
 * what logged-in users see; only the interaction model differs — every
 * "buy"/"add to cart" affordance here routes to /register (or /login) since
 * placing an order requires a wallet-backed account. This is intentionally
 * a read-only browsing experience: no cart mutations are wired up here.
 */

const SAMPLE_PLANS_PER_CATEGORY = 3;

function PriceLabel({ service }: { service: Service }) {
  if (hasVariablePricing(service)) {
    return (
      <span className="text-sm font-semibold text-foreground">
        <span className="mr-1 text-[0.65rem] font-normal uppercase tracking-wide text-muted-foreground">From</span>
        {formatCurrency(service.price, service.currency)}
      </span>
    );
  }
  return <span className="text-sm font-semibold text-foreground">{formatCurrency(service.price, service.currency)}</span>;
}

function SamplePlanRow({ service }: { service: Service }) {
  const { Icon, className } = getServiceIcon(service);
  return (
    <Link
      href={`/register?next=${encodeURIComponent("/services")}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${className}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{service.name}</span>
      <PriceLabel service={service} />
    </Link>
  );
}

function CategorySection({ category, services }: { category: Category; services: Service[] }) {
  const { Icon } = getCategoryIcon(category);
  const sample = services.slice(0, SAMPLE_PLANS_PER_CATEGORY);
  if (!sample.length) return null;

  return (
    <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" id={category.slug}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{category.name}</h2>
          {category.active_services_count != null ? (
            <p className="text-xs text-muted-foreground">{category.active_services_count} plan{category.active_services_count === 1 ? "" : "s"} available</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-0.5 divide-y divide-border">
        {sample.map((service) => (
          <SamplePlanRow key={service.id} service={service} />
        ))}
      </div>
    </article>
  );
}

export default function PublicServicesView() {
  const categories = useCategoriesQuery();
  const services = useServicesQuery();

  const isPending = categories.isPending || services.isPending;
  const error = categories.error || services.error;

  if (isPending) return <TableSkeleton rows={4} cols={3} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />;

  const servicesByCategory = new Map<number, Service[]>();
  for (const service of services.data ?? []) {
    if (service.active === false) continue;
    const key = service.category_id ?? service.category_group?.id;
    if (key == null) continue;
    const list = servicesByCategory.get(key) ?? [];
    list.push(service);
    servicesByCategory.set(key, list);
  }

  const categoriesWithServices = (categories.data ?? []).filter((category) => servicesByCategory.get(category.id)?.length);

  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl font-bold">Browse services</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Data plans, airtime top-ups, gift cards, eSIMs and virtual numbers — explore what&apos;s available on
          CharpsDev. Create a free account to fund your wallet and start ordering in seconds.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="lg" render={<Link href={`/register?next=${encodeURIComponent("/services")}`} />}>
            Create account to order
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="lg" render={<Link href={`/login?next=${encodeURIComponent("/services")}`} />}>
            <LogInIcon data-icon="inline-start" aria-hidden="true" />
            Log in
          </Button>
        </div>
      </div>

      {!categoriesWithServices.length ? (
        <EmptyBlock
          title="No services yet"
          description="There are currently no services available. Check back soon."
          icon={PackageSearchIcon}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoriesWithServices.map((category) => (
            <CategorySection key={category.id} category={category} services={servicesByCategory.get(category.id) ?? []} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/15">
        <Badge variant="secondary">Secure wallet checkout</Badge>
        <p className="text-sm text-muted-foreground">
          Every purchase is paid from your CharpsDev wallet — no card details re-entered for each order, and orders
          that can&apos;t be fulfilled are refunded straight back to your balance.
        </p>
      </div>
    </section>
  );
}
