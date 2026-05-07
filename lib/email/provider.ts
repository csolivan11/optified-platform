import "server-only";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
import { createResendProvider } from "./resend";

/**
 * Email provider factory.
 *
 * Reads config from env vars once at module load. To swap providers, change
 * this file and the env var set — zero changes required at call sites.
 */

let cachedProvider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Email provider not configured. Set RESEND_API_KEY in environment."
    );
  }

  cachedProvider = createResendProvider(apiKey);
  return cachedProvider;
}

/**
 * Send an email. Application code calls this, not the provider directly.
 *
 * Logs and re-throws on failure. Callers decide whether an email failure
 * should block their primary action — invites should block (no point
 * writing an invite row if the email can't be delivered), notifications
 * should swallow.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = getProvider();

  try {
    const result = await provider.send(input);
    console.info(
      `[email:${provider.name}] sent id=${result.id} to=${
        Array.isArray(input.to) ? input.to.map((t) => t.email).join(",") : input.to.email
      } subject="${input.subject}"`
    );
    return result;
  } catch (err) {
    console.error(
      `[email:${provider.name}] send failed subject="${input.subject}"`,
      err
    );
    throw err;
  }
}

/**
 * Standard sender addresses. Application code references these rather
 * than hardcoding email strings, so changing a from-address is a one-line
 * edit here.
 */
export function senders() {
  const brand = "Optified";
  return {
    noreply: {
      email: process.env.EMAIL_FROM_NOREPLY ?? "noreply@optified.com",
      name: brand,
    },
    accounts: {
      email: process.env.EMAIL_FROM_ACCOUNTS ?? "accounts@optified.com",
      name: `${brand} Accounts`,
    },
    coach: {
      email: process.env.EMAIL_FROM_COACH ?? "coach@optified.com",
      name: `${brand} Coaching`,
    },
  };
}
