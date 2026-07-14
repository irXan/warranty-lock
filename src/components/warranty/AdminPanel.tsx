import { ReceiptForm } from "./ReceiptForm";
import { JobBoard } from "./JobBoard";
import { AdminAuthGate } from "./AdminAuthGate";

export function AdminPanel() {
  return (
    <AdminAuthGate>
      <div className="space-y-6">
        <ReceiptForm />
        <JobBoard />
      </div>
    </AdminAuthGate>
  );
}