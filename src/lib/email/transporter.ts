import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

let transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

/**
 * Get (or create) the singleton nodemailer SMTP transporter.
 * Returns `null` when SMTP is not configured so callers can skip sending.
 */
export function getTransporter(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    console.warn("[Email] SMTP_HOST not set — email sending disabled");
    return null;
  }

  const options: SMTPTransport.Options = {
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
    // Timeouts to prevent hanging connections
    connectionTimeout: 10_000, // 10s to establish connection
    greetingTimeout: 10_000,   // 10s for server greeting
    socketTimeout: 30_000,     // 30s for socket inactivity
  };

  transporter = nodemailer.createTransport(options);

  return transporter;
}

/**
 * Reset the transporter singleton (e.g. after connection errors).
 * The next call to getTransporter() will create a fresh instance.
 */
export function resetTransporter(): void {
  if (transporter) {
    try {
      transporter.close();
    } catch {
      // Ignore close errors
    }
    transporter = null;
  }
}

/**
 * The "From" address used for all outgoing emails.
 */
export function getFromAddress(): string {
  return process.env.SMTP_FROM || "Family Hub <noreply@familyhub.local>";
}
