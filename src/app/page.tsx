import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, Compass, LineChart, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_SIGNED_IN_PATH, loginHref, signupHref } from "@/lib/auth/routes";

export const metadata: Metadata = {
  title: "CashCompass — Your money. Your direction.",
  description:
    "See where your money went, where it stands today, and where it's headed next — before you spend it.",
};

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Safe to Spend",
    body: "Not your balance — what's actually free after upcoming bills, savings and your buffer.",
  },
  {
    icon: LineChart,
    title: "Cash-flow forecast",
    body: "Every dated bill, paycheck and repayment on one timeline, with low-balance risks flagged early.",
  },
  {
    icon: Sparkles,
    title: "Ask before you buy",
    body: "“Can I afford a $1,200 laptop?” The copilot runs the numbers on your real forecast.",
  },
] as const;

// Public, signed-out landing page. Signed-in users (and demo mode) go
// straight to the app.
export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(DEFAULT_SIGNED_IN_PATH);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2 text-brand-navy dark:text-foreground">
          <Compass className="size-6" strokeWidth={1.75} aria-hidden="true" />
          <span className="font-heading text-lg font-semibold tracking-tight">CashCompass</span>
        </div>
        <Button
          variant="ghost"
          className="min-h-11 px-4"
          nativeButton={false}
                  role="link"
          render={<a href={loginHref()}>Log in</a>}
        />
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <p className="text-sm font-medium text-interactive">Personal finance, looking ahead</p>
            <h1 className="mt-3 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Your money.
              <br />
              Your direction.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              You may have enough money today. CashCompass shows whether you can afford what happens
              afterward — so the next purchase never puts rent at risk.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="min-h-11 px-6 text-base"
                nativeButton={false}
                  role="link"
                render={<a href={signupHref()}>Get started — it&apos;s free</a>}
              />
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 px-6 text-base"
                nativeButton={false}
                  role="link"
                render={<a href={loginHref()}>Log in</a>}
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Sign up with email or Google. Secured by Auth0.
            </p>
          </div>

          <PreviewCard />
        </section>

        <section aria-labelledby="features-title" className="border-t border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="features-title" className="sr-only">
              What CashCompass does
            </h2>
            <ul className="grid gap-8 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-interactive/10 text-interactive">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-5 text-muted-foreground sm:px-6">
          Banking data in this demo is simulated Capital One Nessie demo data — no real bank accounts or
          credentials. CashCompass is an independent project and is not affiliated with or endorsed by
          Capital One. Forecasts are estimates, not guarantees.
        </p>
      </footer>
    </div>
  );
}

/** Illustrative product preview. Clearly labeled as an example, not anyone's data. */
function PreviewCard() {
  return (
    <figure
      aria-label="Example of the CashCompass overview"
      className="rounded-2xl bg-brand-navy p-6 text-white shadow-[0_12px_32px_rgba(0,73,119,0.25)] dark:bg-card dark:text-foreground"
    >
      <figcaption className="text-xs font-medium uppercase tracking-wide text-white/70 dark:text-muted-foreground">
        Example overview
      </figcaption>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-white/75 dark:text-muted-foreground">Available balance</dt>
          <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">$2,480</dd>
        </div>
        <div>
          <dt className="text-sm text-white/75 dark:text-muted-foreground">Safe to Spend</dt>
          <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">$615</dd>
        </div>
      </dl>
      <div className="mt-6 flex items-start gap-3 rounded-xl bg-white/10 p-4 dark:bg-secondary">
        <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-6">
          Rent is due in 4 days. Spending $450 today would take you below your $300 buffer — after
          payday it&apos;s safe.
        </p>
      </div>
    </figure>
  );
}
