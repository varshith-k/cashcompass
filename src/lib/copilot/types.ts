export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotResult {
  reply: string;
  assumptions: string[];
  actionLabel?: string;
  actionHref?: string;
}
