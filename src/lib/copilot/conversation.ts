import type { ChatMessage } from "./types";

/** Client history provides conversational context, never authoritative account data. */
export function conversationHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error("Invalid conversation history");
  const messages = value.map((entry): ChatMessage => {
    if (!entry || typeof entry !== "object" || !["user", "assistant"].includes(entry.role) || typeof entry.content !== "string" || entry.content.length > 4000) throw new Error("Invalid conversation message");
    return { role: entry.role, content: entry.content };
  });
  while (messages.reduce((total, entry) => total + entry.content.length, 0) > 16000) messages.shift();
  return messages;
}
