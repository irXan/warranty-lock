import { ReceiptForm } from "./ReceiptForm";
import { JobBoard } from "./JobBoard";

export function AdminPanel() {
  return (
    <div className="space-y-6">
      <ReceiptForm />
      <JobBoard />
    </div>
  );
}