import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, type View } from "@/components/warranty/Header";
import { AdminPanel } from "@/components/warranty/AdminPanel";
import { CustomerPanel } from "@/components/warranty/CustomerPanel";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [view, setView] = useState<View>("admin");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header view={view} onChange={setView} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {view === "admin" ? <AdminPanel /> : <CustomerPanel />}
      </main>
    </div>
  );
}
