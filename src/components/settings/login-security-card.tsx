import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Explains two-step verification. Auth0 enforces it on its login page
 * (Require Multi-factor Auth → Always); CashCompass never sees the codes.
 */
export function LoginSecurityCard({ required, isDemo }: { required: boolean; isDemo: boolean }) {
  const on = required && !isDemo;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Sign-in security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Two-step verification</p>
            <p className="text-sm text-muted-foreground">
              {isDemo
                ? "Demo mode: sign-in is handled by Auth0, which isn't connected on this server."
                : on
                  ? "Every sign-in, including with Google, asks for a 6-digit code from your authenticator app (Google Authenticator, Authy or similar)."
                  : "Not turned on for this deployment yet."}
            </p>
          </div>
          <Badge variant="outline" className={on ? "shrink-0 border-positive/40 text-positive" : "shrink-0"}>
            {on ? "Required" : "Off"}
          </Badge>
        </div>

        {on && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Your first sign-in shows a QR code to scan with the app. Save the recovery code it gives you somewhere safe.</li>
            <li>Phone not with you? Choose &ldquo;Try another method&rdquo; to get a code by email, or use your recovery code.</li>
            <li>Lost your phone and your recovery code? Ask a CashCompass admin to reset your two-step verification, then set it up again.</li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
