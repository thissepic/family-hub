import { Worker, type Job } from "bullmq";
import { getConnection } from "./queue";
import { getTransporter, getFromAddress, resetTransporter } from "./transporter";
import {
  verificationEmail,
  passwordResetEmail,
  emailChangedNotification,
  emailChangeVerification,
} from "./templates";

type Locale = "en" | "de";

interface EmailJobData {
  type: "verification" | "password-reset" | "email-change-notification" | "email-change-verification";
  email: string;
  locale: string;
  familyName: string;
  verifyUrl?: string;
  resetUrl?: string;
  oldEmail?: string;
  newEmail?: string;
}

async function handleSendEmail(job: Job<EmailJobData>) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Email] Transporter not configured, skipping email send");
    return;
  }

  const { type, email, locale: rawLocale, familyName } = job.data;
  const locale: Locale = rawLocale === "de" ? "de" : "en";

  let subject: string;
  let html: string;

  switch (type) {
    case "verification": {
      const result = verificationEmail(locale, { familyName, verifyUrl: job.data.verifyUrl! });
      subject = result.subject;
      html = result.html;
      break;
    }
    case "password-reset": {
      const result = passwordResetEmail(locale, { familyName, resetUrl: job.data.resetUrl! });
      subject = result.subject;
      html = result.html;
      break;
    }
    case "email-change-notification": {
      const result = emailChangedNotification(locale, {
        familyName,
        oldEmail: job.data.oldEmail!,
        newEmail: job.data.newEmail!,
      });
      subject = result.subject;
      html = result.html;
      break;
    }
    case "email-change-verification": {
      const result = emailChangeVerification(locale, { familyName, verifyUrl: job.data.verifyUrl! });
      subject = result.subject;
      html = result.html;
      break;
    }
    default:
      console.warn(`[Email] Unknown email type: ${type}`);
      return;
  }

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      html,
    });

    console.log(`[Email] Sent ${type} email to ${email}`);
  } catch (err) {
    // Reset transporter on connection errors so it reconnects on next attempt
    resetTransporter();
    throw err; // Re-throw so BullMQ can retry
  }
}

export function createEmailWorker(): Worker {
  const worker = new Worker(
    "email",
    async (job: Job) => {
      if (job.name === "send-email") {
        return handleSendEmail(job as Job<EmailJobData>);
      }
      console.warn(`[Email] Unknown job: ${job.name}`);
    },
    {
      connection: getConnection() as never,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Email] Job ${job?.name} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Email] Worker error:", err.message);
  });

  return worker;
}
