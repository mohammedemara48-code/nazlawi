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

const g = globalThis as unknown as { mailer?: Mailer };
export const mailer: Mailer = (g.mailer ??= process.env.SMTP_HOST ? new SmtpMailer() : new OutboxMailer());

export async function readOutbox(limit = 50) {
  try {
    const files = (await fs.readdir(OUTBOX_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit);
    return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(OUTBOX_DIR, f), "utf8")) as Mail & { sentAt: string }));
  } catch {
    return [];
  }
}
