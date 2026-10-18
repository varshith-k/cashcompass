"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LoginSecurityLevel } from "@/lib/auth/login-security";
import { setAuthenticatorApp } from "@/lib/auth/security-actions";

interface LoginSecurityCardProps {
  /** null when the setting couldn't be read or isn't set up on this deployment. */
  initialLevel: LoginSecurityLevel | null;
  /** Why the switch is unavailable, if it is. */
  unavailableReason?: string;
}

export function LoginSecurityCard({ initialLevel, unavailableReason }: LoginSecurityCardProps) {
  const [level, setLevel] = useState(initialLevel);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, startSaving] = useTransition();

  function toggle(enabled: boolean) {
    startSaving(async () => {
      const result = await setAuthenticatorApp(enabled);
      if (result.ok) setLevel(result.level);
      setStatus({ ok: result.ok, message: result.message });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Sign-in security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="authenticator-app" className="text-sm font-medium">
              Two-factor sign-in (authenticator app)
            </Label>
            <p className="text-sm text-muted-foreground">
              Optional. After your password or Google sign-in, enter a code from Google Authenticator, Authy or similar. You&apos;ll scan a
              QR code on your next sign-in.
            </p>
          </div>
          <Switch id="authenticator-app" checked={level === "app"} disabled={saving || level === null} onCheckedChange={(checked) => toggle(checked)} />
        </div>

        {unavailableReason && <p className="rounded-lg bg-accent px-3 py-2 text-xs leading-5 text-muted-foreground">{unavailableReason}</p>}
        {status && (
          <p role="status" aria-live="polite" className={status.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {saving ? "Saving…" : status.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
