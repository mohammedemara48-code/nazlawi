import fs from "node:fs/promises";
import path from "node:path";

export type Mail = { to: string; subject: string; text: string; html?: string };
export interface Mailer { send(mail: Mail): Promise<void | boolean> }

export const OUTBOX_DIR = path.join(process.cwd(), ".outbox");

/** Dev mailer: logs to console and writes JSON files to .outbox/ (viewable at /dev/outbox). */
class OutboxMailer implements Mailer {
  async send(mail: Mail) {
    await fs.mkdir(OUTBOX_DIR, { recursive: true });
    const file = path.join(OUTBOX_DIR, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    await fs.writeFile(file, JSON.stringify({ ...mail, sentAt: new Date().toISOString() }, null, 2));
    if (process.env.NODE_ENV !== "test") console.log(`\n[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}\n`);
  }
}

/** Production without SMTP: never touch the filesystem (read-only on Vercel); just log. */
class ConsoleMailer implements Mailer {
  async send(mail: Mail) {
    console.warn(`[mail] SMTP not configured; email NOT sent. to=${mail.to} subject=${mail.subject}`);
    return false;
  }
}

export class SmtpMailer implements Mailer {
  private transport = import("nodemailer").then((n) =>
    n.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    }),
  );
  async send(mail: Mail) {
    const info = await (await this.transport).sendMail({ from: process.env.MAIL_FROM || "Nazlawi <no-reply@nazlawi.example>", ...mail });
    if (!info.accepted?.length) throw Object.assign(new Error("SMTP rejected recipient"), { code: "EENVELOPE" });
  }
}

/** Resend HTTP API (https://resend.com). Needs RESEND_API_KEY and MAIL_FROM (a sender on a domain verified in Resend). */
export class ResendMailer implements Mailer {
  constructor(private key: string, private fetchImpl: typeof fetch = fetch) {}
  async send(mail: Mail) {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "Nazlawi <onboarding@resend.dev>", to: [mail.to], subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** True when real emails can be delivered (Resend or SMTP configured). */
export const emailDeliveryEnabled = () => !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
const outboxAllowed = () => process.env.NODE_ENV !== "production" && !process.env.VERCEL;

/** Masks an address for logs: "ab***@gmail.com". */
export const maskEmail = (e: string) => e.replace(/^(.{0,2})[^@]*@/, "$1***@");
/**
 * Wraps a mailer so delivery failures are logged instead of failing the request (e.g. signup).
 * Returns true when the provider accepted the message, false otherwise. Logs never include secrets.
 */
class SafeMailer implements Mailer {
  constructor(private inner: Mailer) {}
  async send(mail: Mail) {
    try {
      const r = await this.inner.send(mail);
      if (r === false) return false;
      if (process.env.NODE_ENV !== "test") console.log(`[mail] sent:true to=${maskEmail(mail.to)} subject=${mail.subject}`);
      return true;
    } catch (e) {
      if (process.env.NODE_ENV === "test") throw e;
      const err = e as { code?: string; responseCode?: number; message?: string };
      console.error(`[mail] sent:false to=${maskEmail(mail.to)} subject=${mail.subject} code=${err.code ?? "-"} responseCode=${err.responseCode ?? "-"} msg=${String(err.message ?? "").slice(0, 120)}`);
      return false;
    }
  }
}

const g = globalThis as unknown as { mailer?: Mailer };
export const mailer: Mailer = (g.mailer ??= new SafeMailer(
  process.env.RESEND_API_KEY ? new ResendMailer(process.env.RESEND_API_KEY) : process.env.SMTP_HOST ? new SmtpMailer() : outboxAllowed() ? new OutboxMailer() : new ConsoleMailer(),
));

export async function readOutbox(limit = 50) {
  try {
    const files = (await fs.readdir(OUTBOX_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit);
    return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(OUTBOX_DIR, f), "utf8")) as Mail & { sentAt: string }));
  } catch {
    return [];
  }
}

/** Admin diagnostics: send one test email to the configured sender address only (never an arbitrary recipient). Errors propagate. */
export async function sendTestEmail() {
  if (!emailDeliveryEnabled()) return { sent: false, reason: "NOT_CONFIGURED" as const };
  const to = (process.env.SMTP_USER || /<([^>]+)>/.exec(process.env.MAIL_FROM || "")?.[1] || "").trim();
  if (!to) return { sent: false, reason: "NO_RECIPIENT" as const };
  const inner: Mailer = process.env.RESEND_API_KEY ? new ResendMailer(process.env.RESEND_API_KEY) : new SmtpMailer();
  await inner.send({ to, subject: "Nazlawi test email / رسالة تجريبية", text: `Email delivery works. / الإيميل شغال.\n${new Date().toISOString()}` });
  console.log("[mail] test email sent to the sender address");
  return { sent: true as const };
}
