"use client";

import { useActionState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInMethodLabel } from "@/lib/auth/map-user";
import { updateDisplayName, type ProfileFormState } from "@/lib/auth/profile-actions";
import { useAuth } from "@/lib/auth/provider";
import { loginHref, signupHref } from "@/lib/auth/routes";

const INITIAL_STATE: ProfileFormState = { status: "idle", message: "" };

export function AccountCard({ canEditProfile = false }: { canEditProfile?: boolean }) {
  const { user, status, source, logoutHref } = useAuth();
  const [formState, formAction, isSaving] = useActionState(updateDisplayName, INITIAL_STATE);
  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  const badge =
    status !== "authenticated"
      ? "Signed out"
      : source === "demo"
        ? "Demo account"
        : `Signed in with ${signInMethodLabel(user!.id)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="size-12">
          {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="bg-brand-navy text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user?.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {badge}
        </Badge>
      </CardContent>

      {canEditProfile && user && (
        <CardContent className="pt-0">
          <form action={formAction} className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="display-name"
                name="name"
                defaultValue={user.name}
                maxLength={80}
                autoComplete="name"
                required
                aria-describedby="display-name-status"
                className="min-h-11 sm:min-h-9"
              />
              <Button type="submit" disabled={isSaving} className="min-h-11 sm:min-h-9">
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
            <p
              id="display-name-status"
              role="status"
              aria-live="polite"
              className={formState.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
            >
              {formState.message}
            </p>
          </form>
        </CardContent>
      )}

      <CardContent className="pt-0 space-y-3">
        {source === "auth0" && (
          <p className="text-xs leading-5 text-muted-foreground">
            Your email and photo come from your {signInMethodLabel(user!.id)} sign-in, managed securely by Auth0.
            CashCompass never sees your password.
          </p>
        )}
        {source === "demo" ? (
          <p className="rounded-lg bg-accent px-3 py-2 text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">Demo mode.</span> This server is running without Auth0 keys, so
            everyone is the demo user and sign-in, sign-out and account creation are turned off. Add the AUTH0_* values to
            .env.local and restart the server to enable them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Plain <a>: these are full-page redirects through Auth0. */}
            <Button render={<a href={logoutHref}>Sign out</a>} nativeButton={false} role="link" variant="outline" size="sm" />
            <Button render={<a href={loginHref({ forceLogin: true })}>Switch account</a>} nativeButton={false} role="link" variant="ghost" size="sm" />
            <Button render={<a href={signupHref({ forceLogin: true })}>Create another account</a>} nativeButton={false} role="link" variant="ghost" size="sm" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
