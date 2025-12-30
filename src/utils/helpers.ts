export const JURANDIR_PATTERN = /^jurandir[,:]?\s*/i;

export function extractPhoneFromId(id: string): string {
  return id.replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");
}

export function calculateTypingDelay(text: string): number {
  return Math.min(3000, Math.max(500, text.length * 10));
}
