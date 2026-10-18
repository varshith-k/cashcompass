import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Banknote, Check, Gamepad2, HeartPulse, Landmark, ShieldCheck, ShoppingBag, Sparkles, Timer, Wallet } from "lucide-react";
import { NeighborhoodPreview } from "@/components/moneyquest/neighborhood-preview";
import { moneyQuestExperienceUrl } from "@/lib/moneyquest/launcher";

export const metadata: Metadata = {
  title: "MoneyQuest | CashCompass",
  description: "A Roblox financial survival challenge. Make choices, cover your bills, and discover what is really safe to spend.",
};

const steps = ["Earn your paycheck", "Make financial decisions", "Cover your bills", "Protect your future balance", "Survive the month"];
const highlights = [
  { icon: ShoppingBag, title: "The $1,200 temptation", text: "That laptop looks affordable. Will your balance still cover rent before payday?" },
  { icon: Landmark, title: "A neighborhood of choices", text: "Visit the bank, store, apartment, and advisor. Each stop changes the next one." },
  { icon: HeartPulse, title: "Consequences you can see", text: "Track bills, a safety buffer, and savings. Finish with a score that explains the tradeoffs." },
];

export default function MoneyQuestPage() {
  const experienceUrl = moneyQuestExperienceUrl(process.env.NEXT_PUBLIC_ROBLOX_MONEYQUEST_URL);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Gamepad2 className="size-4" aria-hidden="true" /> Play & learn</p>
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden="true" /> Fictional money. Real lessons.</span>
      </div>

      <section aria-labelledby="moneyquest-heading" className="relative isolate overflow-hidden rounded-3xl bg-[#004977] text-white shadow-sm">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,#0276b180,transparent_65%)]" />
        <div className="relative grid items-center gap-1 px-6 pb-7 pt-9 sm:px-9 lg:grid-cols-[1.05fr_1fr] lg:py-10">
          <div className="min-w-0 space-y-5">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-sky-100"><Sparkles className="size-3.5" aria-hidden="true" /> A CashCompass companion</p>
            <div>
              <h1 id="moneyquest-heading" className="font-heading text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl">MoneyQuest<span className="text-[#5ee1c3]">.</span></h1>
              <p className="mt-4 max-w-md font-heading text-xl font-medium leading-snug text-sky-50 sm:text-2xl">Can you survive 30 days<br className="hidden sm:block" /> without going broke?</p>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-sky-100">A paycheck, rent, a tempting purchase. Explore a small Roblox neighborhood and find out why money in your account isn’t always money you can spend.</p>
            <div className="space-y-3 pt-1">
              {experienceUrl ? (
                <a href={experienceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-[#004977] transition-colors hover:bg-sky-50">
                  <Gamepad2 className="size-5 shrink-0" aria-hidden="true" /> Play MoneyQuest on Roblox <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <div className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium"><span className="size-2 rounded-full bg-[#5ee1c3]" aria-hidden="true" /> Game publishing in progress</div>
              )}
              <p className="max-w-sm text-xs leading-relaxed text-sky-100">{experienceUrl ? "Opens on Roblox. Sign in and use Roblox Player to join the experience." : "Our Roblox companion is being prepared for launch. Explore the challenge below, or try the Cash Flow simulator today."}</p>
            </div>
          </div>
          <NeighborhoodPreview />
        </div>
        <div className="relative flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 px-6 py-4 text-xs text-sky-100 sm:px-9">
          <span className="flex items-center gap-2"><Timer className="size-4" aria-hidden="true" /> 2–3 minute target session</span>
          <span className="flex items-center gap-2"><Gamepad2 className="size-4" aria-hidden="true" /> Designed for Roblox</span>
          <span className="flex items-center gap-2"><Wallet className="size-4" aria-hidden="true" /> No real accounts connected</span>
        </div>
      </section>

      <section aria-labelledby="starting-line" className="grid gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive">Your starting line · day 1</p>
          <h2 id="starting-line" className="mt-2 font-heading text-lg font-semibold">Your balance tells half the story.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Rent and groceries arrive before your next paycheck. Keep $400 for savings and a $300 cushion. What’s left for that laptop?</p>
        </div>
        <dl className="grid grid-cols-2 items-center gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Opening balance</dt><dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">$2,500</dd></div>
          <div><dt className="text-xs text-muted-foreground">Rent due · day 5</dt><dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">$1,200</dd></div>
          <div className="col-span-2 rounded-xl bg-secondary p-3 sm:col-span-1"><dt className="text-xs text-muted-foreground">Safe to spend now</dt><dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-positive">$300</dd></div>
        </dl>
      </section>

      <section aria-labelledby="how-to-play">
        <h2 id="how-to-play" className="font-heading text-lg font-semibold">One month. Every choice counts.</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {steps.map((step, index) => <li key={step} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-secondary-foreground">{index + 1}</span>{step}</li>)}
        </ol>
      </section>

      <section aria-label="Game highlights" className="grid gap-4 md:grid-cols-3">
        {highlights.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-border bg-card p-5"><span className="inline-flex rounded-xl bg-secondary p-2.5 text-interactive"><Icon className="size-5" aria-hidden="true" /></span><h2 className="mt-4 font-heading text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>)}
      </section>

      <section aria-labelledby="beyond-game" className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-secondary/60 p-6 sm:flex-row sm:items-center">
        <div><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-positive"><Check className="size-4" aria-hidden="true" /> Take the lesson with you</p><h2 id="beyond-game" className="font-heading text-lg font-semibold">Plan your next move in CashCompass.</h2><p className="mt-1 text-sm text-muted-foreground">Compare buying today with waiting for payday in Cash Flow.</p></div>
        <Link href="/cash-flow" className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground sm:self-auto"><Banknote className="size-4 shrink-0" aria-hidden="true" /> Try the real What-If Simulator <ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
