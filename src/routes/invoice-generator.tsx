import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/invoice-generator")({
  component: InvoiceGeneratorPage,
  head: () => ({
    meta: [
      { title: "Free Auto Repair Invoice Generator — Warranty Flow" },
      {
        name: "description",
        content:
          "Create and print a professional auto repair invoice in seconds. Add labor and parts line items, apply tax, and download a printable PDF — free, no signup.",
      },
      {
        property: "og:title",
        content: "Free Auto Repair Invoice Generator — Warranty Flow",
      },
      {
        property: "og:description",
        content:
          "Build a printable auto repair invoice with labor and parts line items. Free, no signup.",
      },
      {
        property: "og:url",
        content: "https://warranty-lock.lovable.app/invoice-generator",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://warranty-lock.lovable.app/invoice-generator",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Auto Repair Invoice Generator",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "Free tool for auto repair shops to build and print a professional invoice with labor and parts line items.",
        }),
      },
    ],
  }),
});

type LineKind = "labor" | "part";

interface LineItem {
  id: string;
  kind: LineKind;
  description: string;
  quantity: number;
  unitPrice: number;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(n) ? n : 0,
  );

function InvoiceGeneratorPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [shopName, setShopName] = useState("");
  const [shopContact, setShopContact] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);

  const [items, setItems] = useState<LineItem[]>([
    { id: uid(), kind: "labor", description: "Diagnostic labor", quantity: 1, unitPrice: 95 },
    { id: uid(), kind: "part", description: "Brake pads (front)", quantity: 1, unitPrice: 65 },
  ]);

  const addItem = (kind: LineKind) =>
    setItems((prev) => [
      ...prev,
      { id: uid(), kind, description: "", quantity: 1, unitPrice: 0 },
    ]);

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const { laborTotal, partsTotal, subtotal, taxAmount, total } = useMemo(() => {
    let labor = 0;
    let parts = 0;
    for (const it of items) {
      const line = (it.quantity || 0) * (it.unitPrice || 0);
      if (it.kind === "labor") labor += line;
      else parts += line;
    }
    const sub = labor + parts;
    const tax = sub * ((taxRate || 0) / 100);
    return {
      laborTotal: labor,
      partsTotal: parts,
      subtotal: sub,
      taxAmount: tax,
      total: sub + tax,
    };
  }, [items, taxRate]);

  const printInvoice = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Marketing intro — hidden on print */}
        <header className="print:hidden">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Free auto repair invoice generator
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Build a professional auto repair invoice with labor and parts line items,
            apply tax, then print or save as PDF. Runs entirely in your browser — no
            signup, no data leaves this page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => addItem("labor")} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add labor
            </Button>
            <Button onClick={() => addItem("part")} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add part
            </Button>
            <Button onClick={printInvoice} size="sm" className="gap-2">
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
          </div>
        </header>

        {/* Invoice sheet */}
        <section
          id="invoice-sheet"
          className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm print:mt-0 print:border-0 print:shadow-none sm:p-8"
          aria-label="Invoice preview and editor"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </h2>
              <FieldRow>
                <Label htmlFor="shop-name">Shop name</Label>
                <Input
                  id="shop-name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Ace Auto Repair"
                />
              </FieldRow>
              <FieldRow>
                <Label htmlFor="shop-contact">Address / phone / email</Label>
                <Textarea
                  id="shop-contact"
                  rows={3}
                  value={shopContact}
                  onChange={(e) => setShopContact(e.target.value)}
                  placeholder={"123 Main St\n(555) 123-4567\nshop@example.com"}
                />
              </FieldRow>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bill to
              </h2>
              <FieldRow>
                <Label htmlFor="customer-name">Customer name</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </FieldRow>
              <FieldRow>
                <Label htmlFor="customer-contact">Contact</Label>
                <Textarea
                  id="customer-contact"
                  rows={3}
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder={"Phone / email"}
                />
              </FieldRow>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldRow>
              <Label htmlFor="invoice-number">Invoice #</Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </FieldRow>
            <FieldRow>
              <Label htmlFor="invoice-date">Date</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </FieldRow>
            <FieldRow>
              <Label htmlFor="vehicle">Vehicle (year / make / model / VIN)</Label>
              <Input
                id="vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="2019 Toyota Camry — VIN…"
              />
            </FieldRow>
          </div>

          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Line items
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 text-right font-medium">Qty / Hrs</th>
                    <th className="py-2 pr-3 text-right font-medium">Rate</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium print:hidden">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const line = (it.quantity || 0) * (it.unitPrice || 0);
                    return (
                      <tr key={it.id} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-3">
                          <select
                            aria-label="Line type"
                            value={it.kind}
                            onChange={(e) =>
                              updateItem(it.id, { kind: e.target.value as LineKind })
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="labor">Labor</option>
                            <option value="part">Part</option>
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            aria-label="Description"
                            value={it.description}
                            onChange={(e) =>
                              updateItem(it.id, { description: e.target.value })
                            }
                            placeholder={
                              it.kind === "labor"
                                ? "Front brake replacement"
                                : "Brake pads (front)"
                            }
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            aria-label="Quantity or hours"
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            min="0"
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.id, {
                                quantity: Number(e.target.value),
                              })
                            }
                            className="text-right"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            aria-label="Unit price"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={it.unitPrice}
                            onChange={(e) =>
                              updateItem(it.id, {
                                unitPrice: Number(e.target.value),
                              })
                            }
                            className="text-right"
                          />
                        </td>
                        <td className="py-2 pr-3 text-right font-medium tabular-nums">
                          {currency(line)}
                        </td>
                        <td className="py-2 text-right print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove line item"
                            onClick={() => removeItem(it.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <Button onClick={() => addItem("labor")} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add labor
              </Button>
              <Button onClick={() => addItem("part")} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add part
              </Button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FieldRow>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Warranty terms, payment instructions, etc."
              />
            </FieldRow>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <dl className="space-y-1.5 text-sm tabular-nums">
                <Row label="Labor">{currency(laborTotal)}</Row>
                <Row label="Parts">{currency(partsTotal)}</Row>
                <Row label="Subtotal">{currency(subtotal)}</Row>
                <div className="flex items-center justify-between gap-3 py-1">
                  <Label htmlFor="tax-rate" className="text-sm font-normal">
                    Tax rate (%)
                  </Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="h-8 w-24 text-right"
                  />
                </div>
                <Row label="Tax">{currency(taxAmount)}</Row>
                <div className="mt-2 border-t border-border pt-2">
                  <Row label="Total" bold>
                    {currency(total)}
                  </Row>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* SEO content — hidden on print */}
        <section className="mt-10 space-y-4 print:hidden">
          <h2 className="text-xl font-semibold tracking-tight">
            About this auto repair invoice generator
          </h2>
          <p className="text-sm text-muted-foreground">
            Independent mechanics and small auto repair shops often need a fast way
            to issue a professional invoice without paying for shop management
            software. This tool lets you enter labor hours and parts, apply your
            local tax rate, and print or save the invoice as a PDF using your
            browser's built-in print dialog.
          </p>
          <p className="text-sm text-muted-foreground">
            Nothing is uploaded or stored on a server — the invoice lives in your
            browser tab. When you're ready, click{" "}
            <span className="font-medium text-foreground">Print / Save as PDF</span>{" "}
            and choose "Save as PDF" as the destination.
          </p>
        </section>
      </div>

      {/* Print styles: strip chrome, keep only the invoice sheet */}
      <style>{`
        @media print {
          @page { margin: 16mm; }
          body { background: white !important; }
          header, nav, footer { display: none !important; }
          input, textarea, select {
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            color: black !important;
            resize: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function Row({
  label,
  bold,
  children,
}: {
  label: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={bold ? "text-base font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={bold ? "text-base font-semibold" : ""}>{children}</dd>
    </div>
  );
}