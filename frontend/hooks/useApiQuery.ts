"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type UseApiQueryOptions<TResponse, TData> = {
  enabled?: boolean;
  select?: (response: TResponse) => TData;
};

export function useApiQuery<TResponse, TData = TResponse>(
  url: string,
  options?: UseApiQueryOptions<TResponse, TData>,
) {
  const enabled = options?.enabled ?? true;
  const select = options?.select;

  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!enabled) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.get<TResponse>(url);
        const nextData = select ? select(response.data) : (response.data as unknown as TData);
        if (!cancelled) setData(nextData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [url, enabled, reloadToken, select]);

  return { data, loading, error, refetch };
}
