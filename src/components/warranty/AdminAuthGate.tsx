import { useEffect, useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPasscode, isAuthed, setPasscode, signOut, verifyPasscode } from "@/lib/warranty-auth";

interface Props {
  children: React.ReactNode;
}

export function AdminAuthGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFirstRun(!hasPasscode());
    setAuthed(isAuthed());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (authed) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => {
              signOut();
              setAuthed(false);
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
        {children}
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (firstRun) {
      if (pass.length < 4) return setError("Choose at least 4 characters.");
      if (pass !== confirmPass) return setError("Passcodes do not match.");
      setBusy(true);
      await setPasscode(pass);
      setBusy(false);
      setAuthed(true);
      return;
    }
    setBusy(true);
    const ok = await verifyPasscode(pass);
    setBusy(false);
    if (!ok) return setError("Incorrect passcode.");
    setAuthed(true);
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {firstRun ? "Set up admin passcode" : "Admin sign-in"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {firstRun
              ? "Choose a passcode to protect the workshop panel on this device."
              : "Enter your workshop passcode to access receipts."}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pass" className="text-xs uppercase tracking-wide text-muted-foreground">
            Passcode
          </Label>
          <Input
            id="pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoFocus
            autoComplete={firstRun ? "new-password" : "current-password"}
          />
        </div>
        {firstRun && (
          <div className="space-y-1.5">
            <Label htmlFor="pass2" className="text-xs uppercase tracking-wide text-muted-foreground">
              Confirm passcode
            </Label>
            <Input
              id="pass2"
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {firstRun ? "Create passcode" : "Sign in"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Passcode is stored on this device only. Migrating to Lovable Cloud will unlock proper
          multi-device accounts.
        </p>
      </form>
    </div>
  );
}