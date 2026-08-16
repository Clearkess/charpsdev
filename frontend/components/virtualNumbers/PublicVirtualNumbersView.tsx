"use client";

import Link from "next/link";
import { ArrowRightIcon, LogInIcon, PhoneIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useVirtualProvidersQuery } from "@/hooks/queries/useVirtualNumberQueries";
import { extractErrorMessage } from "@/lib/api";

/**
 * Lighter-touch public teaser for /virtual-numbers (Top-3-Fixes, Fix 2) —
 * the checklist calls for a lighter treatment here than the full /services
 * catalogue, since renting a number always requires a live, paid
 * provider-side quote (country/service selection hits real 3rd-party APIs,
 * see useVirtualCountriesQuery/useVirtualServicesQuery, which stay
 * auth-gated). This teaser only surfaces the public, cost-free
 * `GET /virtual-numbers/providers` list (a DB lookup, no 3rd-party cost —
 * see backend routes/api.php, commit fd91d29) so anonymous visitors and
 * crawlers see which providers are supported, plus register/login CTAs.
 */
export default function PublicVirtualNumbersView() {
  const providers = useVirtualProvidersQuery();

  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl font-bold">Virtual Numbers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rent a real number to receive an SMS verification code from any supported service — pay from your wallet,
          no card details re-entered. Create a free account to see live pricing and available countries.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="lg" render={<Link href={`/register?next=${encodeURIComponent("/virtual-numbers")}`} />}>
            Create account
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="lg" render={<Link href={`/login?next=${encodeURIComponent("/virtual-numbers")}`} />}>
            <LogInIcon data-icon="inline-start" aria-hidden="true" />
            Log in
          </Button>
        </div>
      </div>

      {providers.isPending ? (
        <TableSkeleton rows={1} cols={3} />
      ) : providers.error ? (
        <ErrorBlock message={extractErrorMessage(providers.error, "Failed to load providers.")} />
      ) : providers.data?.length ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Supported providers</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {providers.data.map((provider) => (
              <Badge key={provider.slug} variant="outline" className="px-3 py-1.5 text-sm">
                <PhoneIcon className="size-3.5" aria-hidden="true" />
                {provider.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ZapIcon className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">Fast delivery</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Numbers are provisioned instantly and codes typically arrive within seconds.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">Automatic refunds</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              If no code arrives, the order is automatically refunded to your wallet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
