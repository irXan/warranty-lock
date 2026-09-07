import { ReceiptForm } from "./ReceiptForm";
import { JobBoard } from "./JobBoard";
import { AdminAuthGate } from "./AdminAuthGate";
import { WorkshopTools } from "./WorkshopTools";
import { WarrantyClaimsBoard } from "./WarrantyClaimsBoard";

export function AdminPanel() {
  return (
    <AdminAuthGate>
      <div className="space-y-6">
        <ReceiptForm />
        <JobBoard />
        <WarrantyClaimsBoard />
        <WorkshopTools />
      </div>
    </AdminAuthGate>
  );
}
