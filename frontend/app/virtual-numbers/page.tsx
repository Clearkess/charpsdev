"use client";

import AppLayout from "@/components/layout/AppLayout";
import PublicSiteHeader from "@/components/layout/PublicSiteHeader";
import AuthenticatedVirtualNumbersView from "@/components/virtualNumbers/AuthenticatedVirtualNumbersView";
import PublicVirtualNumbersView from "@/components/virtualNumbers/PublicVirtualNumbersView";
import { useAuth } from "@/hooks/useAuth";

/**
 * Dual-mode /virtual-numbers page (Top-3-Fixes, Fix 2) — same pattern as
 * app/services/page.tsx, moved out of app/(dashboard)/virtual-numbers so
 * it renders for anonymous visitors/crawlers instead of being fully hidden
 * behind ProtectedRoute. Unlike /services, the public branch here is a
 * lighter teaser (PublicVirtualNumbersView) rather than a full catalogue —
 * per the checklist, since country/service pricing requires a live 3rd-party
 * quote and stays behind auth regardless (see
 * useVirtualCountriesQuery/useVirtualServicesQuery).
 */
export default function VirtualNumbersPage() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <AppLayout>
        <AuthenticatedVirtualNumbersView />
      </AppLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicSiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <PublicVirtualNumbersView />
      </main>
    </div>
  );
}
