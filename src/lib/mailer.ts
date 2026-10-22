import fs from "node:fs/promises";
import path from "node:path";

export type Mail = { to: string; subject: string; text: string; html?: string };
export interface Mailer { send(mail: Mail): Promise<void> }

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
  }
}

class SmtpMailer implements Mailer {
  private transport = import("nodemailer").then((n) =>
    n.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    }),
  );
  async send(mail: Mail) {
    await (await this.transport).sendMail({ from: process.env.MAIL_FROM || "Nazlawi <no-reply@nazlawi.example>", ...mail });
  }
}

/** True when real emails can be delivered (SMTP configured). */
export const emailDeliveryEnabled = () => !!process.env.SMTP_HOST;
const outboxAllowed = () => process.env.NODE_ENV !== "production" && !process.env.VERCEL;

/** Wraps a mailer so delivery failures are logged instead of failing the request (e.g. signup). */
class SafeMailer implements Mailer {
  constructor(private inner: Mailer) {}
  async send(mail: Mail) {
    try { await this.inner.send(mail); }
    catch (e) {
      if (process.env.NODE_ENV === "test") throw e;
      console.error(`[mail] delivery failed to=${mail.to} subject=${mail.subject}:`, e);
    }
  }
}

const g = globalThis as unknown as { mailer?: Mailer };
export const mailer: Mailer = (g.mailer ??= new SafeMailer(
  process.env.SMTP_HOST ? new SmtpMailer() : outboxAllowed() ? new OutboxMailer() : new ConsoleMailer(),
));

export async function readOutbox(limit = 50) {
  try {
    const files = (await fs.readdir(OUTBOX_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit);
    return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(OUTBOX_DIR, f), "utf8")) as Mail & { sentAt: string }));
  } catch {
    return [];
  }
}
