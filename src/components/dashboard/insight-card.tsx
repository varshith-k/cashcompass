import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InsightCardProps {
  message: string;
  ctaLabel: string;
  ctaHref: string;
}

export function InsightCard({ message, ctaLabel, ctaHref }: InsightCardProps) {
  return (
    <Card className="bg-accent border-interactive/20">
      <CardContent className="flex items-start gap-3 px-5 py-4">
        <div className="rounded-full bg-interactive/10 text-interactive p-2 shrink-0">
          <Lightbulb className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{message}</p>
          <Button
            render={<Link href={ctaHref}>{ctaLabel} →</Link>}
            nativeButton={false}
            variant="link"
            className="h-auto p-0 mt-1.5 text-brand-navy"
          />
        </div>
      </CardContent>
    </Card>
  );
}
