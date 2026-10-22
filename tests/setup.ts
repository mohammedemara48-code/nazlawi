import type { Mail } from "@/lib/mailer";
// Capture emails in memory instead of writing to .outbox/.
export const sent: Mail[] = [];
(globalThis as unknown as { mailer: unknown; sentMails: Mail[] }).sentMails = sent;
(globalThis as unknown as { mailer: unknown }).mailer = { send: async (m: Mail) => { sent.push(m); } };
