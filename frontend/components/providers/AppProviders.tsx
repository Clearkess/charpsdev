"use client";

import type { ReactNode } from "react";
import QueryProvider from "@/components/providers/QueryProvider";
import AuthBootstrap from "@/components/providers/AuthBootstrap";
import { Toaster } from "@/components/ui/toast";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthBootstrap>
        <Toaster>{children}</Toaster>
      </AuthBootstrap>
    </QueryProvider>
  );
}
