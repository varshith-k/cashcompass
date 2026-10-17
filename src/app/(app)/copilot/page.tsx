import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function CopilotPage() {
  return (
    <div>
      <PageHeader
        title="AI Copilot"
        description="Ask Gemini whether a purchase is affordable, grounded in your real forecast data."
      />
      <ComingSoon
        icon={Sparkles}
        title="The Gemini copilot is next up"
        description="Planned for Phase 4. It will call the same deterministic forecast engine as the dashboard — never invent balances or projections."
      />
    </div>
  );
}
