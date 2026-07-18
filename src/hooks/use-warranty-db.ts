import { useQuery } from "@tanstack/react-query";
import { listReceipts, receiptsQueryKey } from "@/lib/warranty-repo";
import type { Receipt } from "@/lib/warranty-db";

/** Admin-only reactive list of receipts (RLS enforces role server-side). */
export function useReceipts(options: { enabled?: boolean } = {}) {
  return useQuery<Receipt[]>({
    queryKey: receiptsQueryKey,
    queryFn: listReceipts,
    enabled: options.enabled ?? true,
    staleTime: 15_000,
  });
}