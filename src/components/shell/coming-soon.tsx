import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center text-center gap-3 py-16 px-6">
        <div className="rounded-full bg-accent text-interactive p-3">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </CardContent>
    </Card>
  );
}
