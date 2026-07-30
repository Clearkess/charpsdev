"use client";

import { useState } from "react";
import { PackageSearchIcon, ShoppingCartIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAddToCartMutation } from "@/hooks/queries/useCartQueries";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";

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
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Services</h1>

      {categories.data?.length ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryId === null ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryId(null)}
          >
            All
          </Button>
          {categories.data.map((category) => (
            <Button
              key={category.id}
              variant={categoryId === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
              {category.active_services_count != null ? (
                <Badge variant={categoryId === category.id ? "secondary" : "muted"} className="ml-1">
                  {category.active_services_count}
                </Badge>
              ) : null}
            </Button>
          ))}
        </div>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((service) => {
            const outOfStock = service.stock != null && service.stock <= 0;
            return (
              <Card key={service.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{service.name}</h2>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {service.category_group?.name || service.category || "uncategorized"}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {service.description || "No description provided."}
                      </p>
                    </div>
                    <Badge variant={service.active === false ? "destructive" : "success"}>
                      {service.active === false ? "Inactive" : "Active"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xl font-bold">{formatCurrency(service.price, service.currency)}</p>
                    {service.stock != null ? (
                      <span className="text-xs text-muted-foreground">
                        {outOfStock ? "Out of stock" : `${service.stock} in stock`}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    disabled={outOfStock || (addToCart.isPending && addToCart.variables?.service_id === service.id)}
                    onClick={() => void onAddToCart(service.id)}
                  >
                    <ShoppingCartIcon data-icon="inline-start" aria-hidden="true" />
                    {addToCart.isPending && addToCart.variables?.service_id === service.id
                      ? "Adding..."
                      : "Add to cart"}
                  </Button>
                  {feedback[service.id] ? (
                    <p className="mt-2 text-xs text-muted-foreground">{feedback[service.id]}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
