"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { askCopilot } from "@/lib/copilot/actions";
import type { CopilotResult } from "@/lib/copilot/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Can I afford a $1,200 MacBook today?",
  "What happens if my roommate pays me five days late?",
  "How much should I save every week for my Miami trip?",
  "Show me where I overspent this month.",
  "Can I save $200 without risking my upcoming bills?",
];



interface Turn {
  role: "user" | "assistant";
  content: string;
  result?: CopilotResult;
}

export function CopilotChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [turns, pending]);


  async function send(message: string) {
    if (!message.trim() || pending) return;
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setPending(true);
    try {
      const result = await askCopilot(message);
      setTurns((prev) => [...prev, { role: "assistant", content: result.reply, result }]);
    } catch {
      setTurns((prev) => [...prev, { role: "assistant", content: "Unable to check your financial data. Please try again." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col h-[70vh]">
      <CardContent role="log" aria-label="Copilot conversation" aria-live="polite" className="flex-1 overflow-y-auto space-y-4" ref={scrollRef}>
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="text-left text-sm rounded-full border border-border bg-accent px-3 py-1.5 hover:bg-accent/70 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={cn("flex gap-2.5", turn.role === "user" && "justify-end")}>
            {turn.role === "assistant" && (
              <div className="rounded-full bg-brand-navy text-white p-1.5 h-fit shrink-0">
                <Sparkles className="size-3.5" />
              </div>
            )}
            <div
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-sm max-w-[85%]",
                turn.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent",
              )}
            >
              {turn.result?.engine && <p className="text-xs text-muted-foreground mb-1">{turn.result.engine === "gemini" ? turn.result.kind === "guidance" ? "Gemini · CashCompass guide" : "Gemini · verified calculations" : turn.result.engine === "fallback" ? "Local response · Gemini fallback" : "Local calculation mode · Gemini not connected"}</p>}
              <p className="leading-relaxed">{turn.content}</p>
              {turn.result?.comparison && <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {turn.result.comparison.map((item) => <div key={item.label} className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
                  <p className="font-semibold">{item.label}</p>
                  <p>Expected minimum: {formatCurrency(item.minBalance, { cents: true })}</p>
                  <p>Without money owed to you: {formatCurrency(item.conservativeMinBalance, { cents: true })}</p>
                  <p>{item.billsAtRisk}/{item.totalBills} bills at risk · {formatCurrency(item.bufferThreshold)} buffer</p>
                  <p className={item.affordable ? "text-positive" : "text-caution"}>{item.affordable ? "Within buffer" : "Review spending"}</p>
                </div>)}
              </div>}
              {turn.result && turn.result.assumptions.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {turn.result.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              {turn.result?.actionHref && (
                <Button
                  render={
                    <Link href={turn.result.actionHref}>
                      {turn.result.actionLabel}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  }
                  nativeButton={false}
                  role="link"
                  variant="link"
                  className="h-auto p-0 mt-1.5 text-brand-navy dark:text-primary"
                />
              )}
            </div>
            {turn.role === "user" && (
              <div className="rounded-full bg-muted p-1.5 h-fit shrink-0">
                <User className="size-3.5" />
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking your request against recorded financial data…
          </div>
        )}
      </CardContent>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a purchase, a bill, or a savings goal…"
          aria-label="Message the copilot"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
