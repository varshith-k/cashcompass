import { PageHeader } from "@/components/shell/page-header";
import { CopilotChat } from "@/components/copilot/copilot-chat";

export const metadata = { title: "Financial Copilot" };

export default function CopilotPage() {
  return (
    <div>
      <PageHeader
        title="AI Copilot"
        description="Ask whether a purchase is affordable, grounded in your real forecast, never invented."
      />
      <CopilotChat />
    </div>
  );
}
