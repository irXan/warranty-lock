import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header, type View } from "@/components/warranty/Header";
import { AdminPanel } from "@/components/warranty/AdminPanel";
import { CustomerPanel } from "@/components/warranty/CustomerPanel";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Warranty Flow — Immutable Repair Receipts & Tracking" },
      {
        name: "description",
        content:
          "Issue tamper-proof electronics repair receipts and let customers track every repair stage with a unique Track ID.",
      },
      { property: "og:title", content: "Warranty Flow — Immutable Repair Receipts & Tracking" },
      {
        property: "og:description",
        content:
          "Issue locked repair receipts and let customers follow their device through every repair stage.",
      },
      { property: "og:url", content: "https://warranty-lock.lovable.app/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://warranty-lock.lovable.app/" }],
  }),
});

function Index() {
  const [view, setView] = useState<View>("admin");

  // Deep-link from QR / shared URL: /?track=... opens the customer view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("track")) setView("customer");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header view={view} onChange={setView} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="sr-only">Warranty Flow — Immutable Repair Receipts &amp; Tracking</h1>
        {view === "admin" ? <AdminPanel /> : <CustomerPanel />}
      </main>
    </div>
  );
}
