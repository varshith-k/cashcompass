import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTH_ERROR_COPY, classifyAuthError } from "@/lib/auth/errors";
import { loginHref, signupHref } from "@/lib/auth/routes";

export const metadata: Metadata = {
  title: "Sign-in problem · CashCompass",
  robots: { index: false },
};

// Friendly landing for failed sign-ins (redirected here by src/lib/auth0.ts
// onCallback and src/proxy.ts). Only fixed copy is shown — never the raw
// error, which can echo query input.
export default async function AuthErrorPage({ searchParams }: PageProps<"/auth-error">) {
  const { code } = await searchParams;
  const copy = AUTH_ERROR_COPY[classifyAuthError(typeof code === "string" ? code : null)];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-brand-navy dark:text-interactive">
            <Compass className="size-5" aria-hidden="true" />
            <span className="font-heading text-sm font-semibold">CashCompass</span>
          </div>
          <CardTitle role="alert" className="font-heading text-xl">
            {copy.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm leading-6 text-muted-foreground">{copy.message}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="min-h-11" nativeButton={false} render={<a href={loginHref()}>Try signing in again</a>} />
            <Button
              size="lg"
              variant="outline"
              className="min-h-11"
              nativeButton={false}
              render={<a href={signupHref()}>Create an account</a>}
            />
          </div>
          <Link href="/" className="inline-block text-sm font-medium text-interactive hover:underline">
            Back to CashCompass
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
