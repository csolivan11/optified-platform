import "server-only";

/**
 * Email provider abstraction.
 *
 * Application code (invite flow, password reset, notifications) depends
 * only on this interface. The concrete provider is selected in
 * `./provider.ts` via environment configuration.
 *
 * Why this matters:
 *   - Lets us start with Resend and move to Postmark/SES/SendGrid later
 *     without touching the 20+ call sites that send email.
 *   - Makes unit testing trivial: swap in a MockEmailProvider that records
 *     calls.
 *   - Forces us to think in terms of "I want to send a thing" rather than
 *     Resend's specific API shape.
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface SendEmailInput {
  to: EmailAddress | EmailAddress[];
  from: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  html: string;
  text?: string;          // plain-text fallback
  tags?: Record<string, string>;  // provider tagging for analytics
  /**
   * Idempotency key. If the same key is submitted twice within the
   * provider's dedup window, the second send is a no-op. Use this for
   * actions that could be triggered multiple times (e.g. a clicky
   * admin smashing "Resend invite" three times in a row).
   */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  id: string;                    // provider's message ID
  provider: string;              // 'resend', 'postmark', etc.
}

export interface EmailProvider {
  name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}
