import "server-only";

export { sendEmail, senders } from "./provider";
export {
  inviteEmail,
  passwordResetEmail,
  welcomeEmail,
  type InviteEmailProps,
  type PasswordResetEmailProps,
  type WelcomeEmailProps,
} from "./templates";
export { EmailSendError } from "./types";
export type {
  EmailAddress,
  SendEmailInput,
  SendEmailResult,
  EmailProvider,
} from "./types";
