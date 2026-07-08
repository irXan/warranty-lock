import { useEffect, useState } from "react";
import { listReceipts, type Receipt } from "@/lib/warranty-db";

export function useReceipts(): Receipt[] {
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    const sync = () => setReceipts(listReceipts());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "warranty_flow_db" || e.key === null) sync();
    };
    window.addEventListener("warranty_flow_db:change", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("warranty_flow_db:change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return receipts;
}