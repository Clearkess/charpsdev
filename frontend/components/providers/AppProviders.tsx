"use client";

import type { ReactNode } from "react";
import QueryProvider from "@/components/providers/QueryProvider";
import AuthBootstrap from "@/components/providers/AuthBootstrap";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toast";
import SupportButtons from "@/components/common/SupportButtons";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthBootstrap>
          <Toaster>{children}</Toaster>
          <SupportButtons />
        </AuthBootstrap>
      </QueryProvider>
    </ThemeProvider>
  );
}
