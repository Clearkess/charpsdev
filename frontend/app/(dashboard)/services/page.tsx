"use client";

import { useMemo, useState } from "react";
import { ChevronRightIcon, FlameIcon, PackageSearchIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAddToCartMutation } from "@/hooks/queries/useCartQueries";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getCategoryIcon, getServiceIcon, hasVariablePricing } from "@/lib/serviceIcons";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import type { Service } from "@/types/api";

/** How many active services to surface in the "Featured Services" banner. */
const FEATURED_COUNT = 6;

function ServiceIconBubble({
  service,
  size = "default",
}: {
  service: Pick<Service, "name" | "category" | "category_group">;
  size?: "default" | "sm";
}) {
  const { Icon, className } = getServiceIcon(service);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-4.5" : "size-5.5"} aria-hidden="true" />
    </span>
  );
}

function PriceTag({ service }: { service: Service }) {
  if (hasVariablePricing(service)) {
    return (
      <p className="text-sm font-semibold text-foreground">
        <span className="text-[0.65rem] font-normal uppercase tracking-wide text-muted-foreground">Starting from </span>
        {formatCurrency(service.price, service.currency)}
      </p>
    );
  }
  return <p className="text-sm font-semibold text-foreground">{formatCurrency(service.price, service.currency)}</p>;
}

/** Horizontally-scrolling strip of highlighted services shown above the catalog grid. */
function FeaturedBanner({
  services,
  onSelect,
  pendingId,
}: {
  services: Service[];
  onSelect: (serviceId: number) => void;
  pendingId?: number;
}) {
  if (!services.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <FlameIcon className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Featured Services</h2>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:px-0">
        {services.map((service) => {
          const outOfStock = service.stock != null && service.stock <= 0;
          return (
            <button
              key={service.id}
              type="button"
              disabled={outOfStock || pendingId === service.id}
              onClick={() => onSelect(service.id)}
              className="flex w-44 shrink-0 flex-col gap-2 rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-3 text-left ring-1 ring-primary/15 transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
            >
              <ServiceIconBubble service={service} />
              <p className="line-clamp-2 text-sm font-medium leading-snug">{service.name}</p>
              <PriceTag service={service} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontally-scrolling row of category filter chips, "All" plus every active category. */
function CategoryChips({
  categoryId,
  onChange,
  categories,
}: {
  categoryId: number | null;
  onChange: (id: number | null) => void;
  categories: Array<{ id: number; name: string; icon?: string | null; active_services_count?: number }>;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Button
        variant={categoryId === null ? "default" : "outline"}
        size="sm"
        className="shrink-0 rounded-full"
        onClick={() => onChange(null)}
      >
        All
      </Button>
      {categories.map((category) => {
        const { Icon } = getCategoryIcon(category);
        const active = categoryId === category.id;
        return (
          <Button
            key={category.id}
            variant={active ? "default" : "outline"}
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => onChange(category.id)}
          >
            <Icon data-icon="inline-start" className="size-3.5" aria-hidden="true" />
            {category.name}
            {category.active_services_count != null ? (
              <Badge variant={active ? "secondary" : "muted"} className="ml-1">
                {category.active_services_count}
              </Badge>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

/** Compact catalog card: icon, name, category, price/"Starting from" label, and a
 * chevron affordance. The whole card is a single button so the tap target
 * matches the visual "this is clickable" cue instead of nesting controls. */
function ServiceCard({
  service,
  onAdd,
  pending,
  feedback,
}: {
  service: Service;
  onAdd: (serviceId: number) => void;
  pending: boolean;
  feedback?: string;
}) {
  const outOfStock = service.stock != null && service.stock <= 0;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={outOfStock || pending}
        onClick={() => onAdd(service.id)}
        aria-label={`Add ${service.name} to cart`}
        className="group flex h-full flex-col rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 transition-colors hover:ring-primary/40 disabled:pointer-events-none disabled:opacity-50"
      >
        <div className="flex items-start justify-between gap-2">
          <ServiceIconBubble service={service} size="sm" />
          {outOfStock ? (
            <Badge variant="destructive" className="shrink-0">Out of stock</Badge>
          ) : service.stock != null && service.stock <= 5 ? (
            <Badge variant="warning" className="shrink-0">{service.stock} left</Badge>
          ) : null}
        </div>

        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{service.name}</p>
        <p className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
          {service.category_group?.name || service.category || "uncategorized"}
        </p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <PriceTag service={service} />
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </button>
      {feedback ? <p className="mt-1 px-1 text-xs text-muted-foreground">{feedback}</p> : null}
    </div>
  );
}

export default function ServicesPage() {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const categories = useCategoriesQuery();
  const { data, isPending, error } = useServicesQuery(categoryId);
  const addToCart = useAddToCartMutation();
  const searchTerm = useUiStore((state) => state.serviceSearchTerm);
  const setServiceSearchTerm = useUiStore((state) => state.setServiceSearchTerm);
  const clearSearch = () => setServiceSearchTerm("");
  const [feedback, setFeedback] = useState<Record<number, string>>({});

  const onAddToCart = async (serviceId: number) => {
    setFeedback((prev) => ({ ...prev, [serviceId]: "" }));
    try {
      await addToCart.mutateAsync({ service_id: serviceId, quantity: 1 });
      setFeedback((prev) => ({ ...prev, [serviceId]: "Added to cart" }));
    } catch (error) {
      setFeedback((prev) => ({ ...prev, [serviceId]: extractErrorMessage(error, "Failed to add to cart.") }));
    }
  };

  const featured = useMemo(
    () => (data || []).filter((service) => service.active !== false).slice(0, FEATURED_COUNT),
    [data],
  );

  if (isPending) return <TableSkeleton rows={4} cols={3} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = normalizedSearch
    ? (data || []).filter((service) =>
        [service.name, service.category_group?.name, service.category, service.description]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(normalizedSearch)),
      )
    : data || [];

  return (
    <section className="space-y-5">
      <h1 className="font-heading text-3xl font-bold">Services</h1>

      {!normalizedSearch && categoryId === null ? (
        <FeaturedBanner services={featured} onSelect={onAddToCart} pendingId={addToCart.variables?.service_id} />
      ) : null}

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={searchTerm}
          onChange={(event) => setServiceSearchTerm(event.target.value)}
          type="search"
          placeholder="Search services..."
          aria-label="Search services"
          className="h-10 rounded-full pl-9"
        />
      </div>

      {categories.data?.length ? (
        <CategoryChips categoryId={categoryId} onChange={setCategoryId} categories={categories.data} />
      ) : null}

      {normalizedSearch ? (
        <p className="text-sm text-muted-foreground">
          {filtered.length} result{filtered.length === 1 ? "" : "s"} for &ldquo;{searchTerm}&rdquo;
        </p>
      ) : null}

      {!data?.length ? (
        <EmptyBlock
          title="No services yet"
          description="There are currently no services available in this category. Check back soon, or browse another category."
          icon={PackageSearchIcon}
        />
      ) : !filtered.length ? (
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onAdd={onAddToCart}
              pending={addToCart.isPending && addToCart.variables?.service_id === service.id}
              feedback={feedback[service.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
