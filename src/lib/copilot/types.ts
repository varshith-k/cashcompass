export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotResult {
  reply: string;
  engine?: "gemini" | "offline" | "fallback";
  kind?: "guidance";
  comparison?: { label: string; minBalance: number; conservativeMinBalance: number; billsAtRisk: number; totalBills: number; bufferThreshold: number; affordable: boolean; purchaseDate: string }[];
  assumptions: string[];
  actionLabel?: string;
  actionHref?: string;
}
