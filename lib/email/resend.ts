import "server-only";
import {
  type EmailProvider,
  type SendEmailInput,
  type SendEmailResult,
  EmailSendError,
} from "./types";

/**
 * Resend provider implementation.
 *
 * Uses raw fetch rather than the `resend` npm package for two reasons:
 *   1. No additional dependency — the Resend REST API is trivial.
 *   2. Works uniformly in Node and Edge runtimes (the SDK had issues
 *      with Edge at time of writing).
 *
 * API reference: https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_API_BASE = "https://api.resend.com";

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string | string[];
  tags?: Array<{ name: string; value: string }>;
}

interface ResendEmailResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode?: number;
  message?: string;
  name?: string;
}

function formatAddress(addr: { email: string; name?: string }): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

export function createResendProvider(apiKey: string): EmailProvider {
  if (!apiKey) {
    throw new Error("createResendProvider: apiKey is required");
  }

  return {
    name: "resend",

    async send(input: SendEmailInput): Promise<SendEmailResult> {
      const toList = Array.isArray(input.to) ? input.to : [input.to];

      const payload: ResendEmailPayload = {
        from: formatAddress(input.from),
        to: toList.map(formatAddress),
        subject: input.subject,
        html: input.html,
      };

      if (input.text) payload.text = input.text;
      if (input.replyTo) payload.reply_to = formatAddress(input.replyTo);
      if (input.tags) {
        payload.tags = Object.entries(input.tags).map(([name, value]) => ({
          name,
          value,
        }));
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      if (input.idempotencyKey) {
        headers["Idempotency-Key"] = input.idempotencyKey;
      }

      const res = await fetch(`${RESEND_API_BASE}/emails`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errBody: ResendErrorResponse = {};
        try {
          errBody = (await res.json()) as ResendErrorResponse;
        } catch {
          // non-JSON error body
        }
        throw new EmailSendError(
          `Resend API error (${res.status}): ${
            errBody.message ?? res.statusText
          }`,
          "resend",
          errBody
        );
      }

      const body = (await res.json()) as ResendEmailResponse;
      return { id: body.id, provider: "resend" };
    },
  };
}
