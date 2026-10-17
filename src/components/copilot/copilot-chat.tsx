"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { askCopilot } from "@/lib/copilot/actions";
import type { CopilotResult } from "@/lib/copilot/types";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Can I afford a $1,200 MacBook today?",
  "What happens if my roommate pays me five days late?",
  "How much should I save every week for my Miami trip?",
  "Show me where I overspent this month.",
  "Can I save $200 without risking my upcoming bills?",
];

const PROGRESSION = ["Analyzing your request", "Checking upcoming obligations", "Simulating scenarios", "Preparing recommendation"];

interface Turn {
  role: "user" | "assistant";
  content: string;
  result?: CopilotResult;
}

export function CopilotChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  useEffect(() => {
    if (!pending) return;
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PROGRESSION.length - 1));
    }, 450);
    return () => clearInterval(interval);
  }, [pending]);

  async function send(message: string) {
    if (!message.trim() || pending) return;
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setStepIndex(0);
    setPending(true);
    try {
      const result = await askCopilot(message);
      setTurns((prev) => [...prev, { role: "assistant", content: result.reply, result }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col h-[70vh]">
      <CardContent className="flex-1 overflow-y-auto space-y-4" ref={scrollRef}>
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
                turn.role === "user" ? "bg-interactive text-white" : "bg-accent",
              )}
            >
              <p className="leading-relaxed">{turn.content}</p>
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
                  variant="link"
                  className="h-auto p-0 mt-1.5 text-interactive"
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {PROGRESSION[stepIndex]}…
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
