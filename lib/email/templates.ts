import "server-only";
import { emailLayout, e } from "./layout";

/**
 * Transactional email templates.
 *
 * Each template exports a function that returns { subject, html, text }.
 * HTML uses the shared layout; plaintext is hand-written for maximum
 * deliverability (many spam filters penalize HTML-only emails).
 */

// ─── CLIENT INVITE ──────────────────────────────────────────
export interface InviteEmailProps {
  acceptUrl: string;
  inviterName: string;   // e.g. "Coach David"
  recipientFirstName?: string;
  expiresInHours: number;
}

export function inviteEmail(props: InviteEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = props.recipientFirstName
    ? `Hi ${props.recipientFirstName},`
    : "Welcome,";

  const html = emailLayout({
    preview: `${props.inviterName} has invited you to Optified.`,
    children: `
      ${e.heading("You've been invited to Optified.")}
      ${e.paragraph(greeting)}
      ${e.paragraph(
        `${props.inviterName} has personally invited you to join Optified — a premium health optimization platform built for people who take their performance seriously.`
      )}
      ${e.paragraph(
        "Click below to accept your invitation and set up your account. It takes about two minutes."
      )}
      ${e.button(props.acceptUrl, "Accept invitation")}
      ${e.codeLink(props.acceptUrl)}
      ${e.divider()}
      ${e.smallMuted(
        `This invitation expires in ${props.expiresInHours} hours for security. If it expires, just ask your coach to resend it.`
      )}
    `,
  });

  const text = `${greeting}

${props.inviterName} has personally invited you to join Optified — a premium health optimization platform built for people who take their performance seriously.

Accept your invitation and set up your account here:
${props.acceptUrl}

This invitation expires in ${props.expiresInHours} hours for security. If it expires, just ask your coach to resend it.

— Optified Medical`;

  return {
    subject: `${props.inviterName} has invited you to Optified`,
    html,
    text,
  };
}

// ─── PASSWORD RESET ─────────────────────────────────────────
export interface PasswordResetEmailProps {
  resetUrl: string;
  expiresInMinutes: number;
  requestedFromIp?: string;
}

export function passwordResetEmail(props: PasswordResetEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const html = emailLayout({
    preview: "Reset your Optified password.",
    children: `
      ${e.heading("Reset your password.")}
      ${e.paragraph(
        "We received a request to reset the password for your Optified account. Click below to choose a new one."
      )}
      ${e.button(props.resetUrl, "Reset password")}
      ${e.codeLink(props.resetUrl)}
      ${e.divider()}
      ${e.smallMuted(
        `This link expires in ${props.expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email — your password won't change.${
          props.requestedFromIp
            ? ` (Request came from ${props.requestedFromIp}.)`
            : ""
        }`
      )}
    `,
  });

  const text = `We received a request to reset the password for your Optified account.

Reset your password here:
${props.resetUrl}

This link expires in ${props.expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email — your password won't change.${
    props.requestedFromIp ? `\n\nRequest came from ${props.requestedFromIp}.` : ""
  }

— Optified Medical`;

  return { subject: "Reset your Optified password", html, text };
}

// ─── WELCOME (sent after invite acceptance) ─────────────────
export interface WelcomeEmailProps {
  dashboardUrl: string;
  firstName?: string;
  coachName?: string;
}

export function welcomeEmail(props: WelcomeEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = props.firstName ? `Welcome, ${props.firstName}.` : "Welcome.";
  const coachLine = props.coachName
    ? `${props.coachName} will be in touch shortly to kick off your program.`
    : "Your coach will be in touch shortly to kick off your program.";

  const html = emailLayout({
    preview: "Your Optified account is ready.",
    children: `
      ${e.heading(greeting)}
      ${e.paragraph(
        "Your account is active. You now have access to your personalized dashboard, where you'll track biomarkers, protocols, and progress across your program."
      )}
      ${e.paragraph(coachLine)}
      ${e.button(props.dashboardUrl, "Go to your dashboard")}
      ${e.divider()}
      ${e.smallMuted(
        "Optified is built on the principle that your recommendations should never carry a conflict of interest. We don't sell supplements or earn commission on anything we suggest — our only incentive is your results."
      )}
    `,
  });

  const text = `${greeting}

Your Optified account is active. You now have access to your personalized dashboard, where you'll track biomarkers, protocols, and progress across your program.

${coachLine}

Go to your dashboard:
${props.dashboardUrl}

— Optified Medical`;

  return { subject: "Your Optified account is ready", html, text };
}
