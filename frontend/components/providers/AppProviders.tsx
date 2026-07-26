"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toast";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Toaster>{children}</Toaster>
    </AuthProvider>
  );
}
