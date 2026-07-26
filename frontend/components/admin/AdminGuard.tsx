"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isAdmin } = useAuthGuard();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, isAdmin, router]);

  if (loading) return <div className="p-6 text-sm text-neutral-500">Checking admin access...</div>;
  if (!isAdmin) return null;
  return <>{children}</>;
}
