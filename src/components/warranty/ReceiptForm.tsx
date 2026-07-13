import { useId, useState, cloneElement, isValidElement, type ReactElement } from "react";
import { FileLock2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addReceipt,
  DEFAULT_WARRANTY_DAYS,
  WARRANTY_OPTIONS,
  type NewReceiptInput,
} from "@/lib/warranty-db";
import { TrackIdModal } from "./TrackIdModal";

type Errors = Partial<Record<keyof NewReceiptInput, string>>;

const initial: NewReceiptInput = {
  customerName: "",
  customerPhone: "",
  deviceModel: "",
  serialNumber: "",
  issueDescription: "",
  warrantyDays: DEFAULT_WARRANTY_DAYS,
};

function validate(v: NewReceiptInput): Errors {
  const e: Errors = {};
  if (v.customerName.trim().length < 3) e.customerName = "Name must be at least 3 characters.";
  if (!v.customerPhone.trim()) e.customerPhone = "Phone is required.";
  if (!v.deviceModel.trim()) e.deviceModel = "Device model is required.";
  if (!v.serialNumber.trim()) e.serialNumber = "Serial / IMEI is required.";
  if (v.issueDescription.trim().length < 10)
    e.issueDescription = "Describe the issue in at least 10 characters.";
  return e;
}

export function ReceiptForm() {
  const [values, setValues] = useState<NewReceiptInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [newTrackId, setNewTrackId] = useState<string | null>(null);

  const update = <K extends keyof NewReceiptInput>(k: K, v: NewReceiptInput[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed: NewReceiptInput = {
      customerName: values.customerName.trim(),
      customerPhone: values.customerPhone.trim(),
      deviceModel: values.deviceModel.trim(),
      serialNumber: values.serialNumber.trim(),
      issueDescription: values.issueDescription.trim(),
      warrantyDays: values.warrantyDays,
    };
    const errs = validate(trimmed);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const receipt = addReceipt(trimmed);
    setValues(initial);
    setErrors({});
    setNewTrackId(receipt.trackId);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileLock2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Create receipt</h2>
          <p className="text-sm text-muted-foreground">
            Once generated, the core details cannot be edited or deleted.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Customer name" error={errors.customerName}>
          <Input
            value={values.customerName}
            onChange={(e) => update("customerName", e.target.value)}
            placeholder="Jane Doe"
            aria-invalid={!!errors.customerName}
            className={cn(errors.customerName && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>

        <Field label="Customer phone" error={errors.customerPhone}>
          <Input
            type="tel"
            value={values.customerPhone}
            onChange={(e) => update("customerPhone", e.target.value)}
            placeholder="+1 (555) 123-4567"
            aria-invalid={!!errors.customerPhone}
            className={cn(errors.customerPhone && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>

        <Field label="Device model" error={errors.deviceModel}>
          <Input
            value={values.deviceModel}
            onChange={(e) => update("deviceModel", e.target.value)}
            placeholder="iPhone 15 Pro"
            aria-invalid={!!errors.deviceModel}
            className={cn(errors.deviceModel && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>

        <Field label="Serial / IMEI" error={errors.serialNumber}>
          <Input
            value={values.serialNumber}
            onChange={(e) => update("serialNumber", e.target.value)}
            placeholder="SN-987654321"
            aria-invalid={!!errors.serialNumber}
            className={cn(errors.serialNumber && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Issue description" error={errors.issueDescription}>
            <Textarea
              rows={4}
              value={values.issueDescription}
              onChange={(e) => update("issueDescription", e.target.value)}
              placeholder="Screen cracked and battery draining rapidly."
              aria-invalid={!!errors.issueDescription}
              className={cn(
                errors.issueDescription && "border-destructive focus-visible:ring-destructive",
              )}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm font-medium text-foreground">Warranty period</Label>
                <p className="text-xs text-muted-foreground">
                  Starts automatically when the device is marked <em>Delivered</em>.
                </p>
              </div>
            </div>
            <Select
              value={String(values.warrantyDays)}
              onValueChange={(v) => update("warrantyDays", Number(v))}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARRANTY_OPTIONS.map((o) => (
                  <SelectItem key={o.days} value={String(o.days)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="sm:col-span-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            A unique Track ID is minted on submit and locked into local storage.
          </p>
          <Button type="submit" size="lg" className="gap-2">
            <FileLock2 className="h-4 w-4" />
            Generate immutable receipt
          </Button>
        </div>
      </form>

      <TrackIdModal trackId={newTrackId} onClose={() => setNewTrackId(null)} />
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const describedById = error ? `${id}-error` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedById,
      })
    : children;
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {child}
      {error ? (
        <p id={describedById} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}