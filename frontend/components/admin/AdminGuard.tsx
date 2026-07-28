"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isAdmin } = useAuthGuard();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        Checking admin access...
      </div>
    );
  }
  if (!isAdmin) return null;
  return <>{children}</>;
}
