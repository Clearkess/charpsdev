"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/queryClient";

export default function QueryProvider({ children }: { children: ReactNode }) {
  // useState (not useMemo) guarantees the client survives StrictMode's double-invoke
  // and is created exactly once per component instance / browser tab.
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
