import "server-only";

/**
 * Email layout.
 *
 * Transactional email is a graveyard for modern CSS. Most clients (Outlook,
 * Gmail web, Yahoo) strip flexbox, grid, custom properties, and media
 * queries in unpredictable ways. The only reliable approach is inline-styled
 * tables with hex colors and pixel units.
 *
 * This wrapper applies the Optified brand aesthetic within those constraints.
 * It's visually distinct from generic SaaS transactional email: dark navy
 * background, cloud-white content card, generous type, subtle brand touches.
 */

// Brand color constants (duplicated from Tailwind config because email clients
// don't read Tailwind)
const C = {
  bgOuter: "#0F1D33",
  bgCard: "#ffffff",
  textPrimary: "#0F1D33",
  textSecondary: "#40424D",
  textMuted: "#6E7180",
  border: "#D3D6E0",
  brand: "#192C4C",
  accent: "#10B981",
};

interface EmailLayoutOptions {
  preview: string;   // preheader text (shown in inbox preview)
  children: string;  // inner HTML
}

export function emailLayout({ preview, children }: EmailLayoutOptions): string {
  // The Optified mark SVG, inlined as a data URI so it renders without
  // hotlinking. Email clients block most external images by default.
  const markSvg = `
    <svg width="32" height="32" viewBox="395 395 115 115" xmlns="http://www.w3.org/2000/svg">
      <path fill="${C.brand}" d="M470.74,404.16l-34.1,41.57,6.1,7.14c7.22,8.45,7.22,20.9,0,29.35l-2.88,3.37-33.86-39.9,31.25-38.12c1.77-2.15,4.41-3.4,7.19-3.4h26.3Z"/>
      <path fill="${C.brand}" d="M512.9,445.69l-32.49,38.28c-1.77,2.08-4.36,3.28-7.09,3.28h-26.55l35.48-41.51-6.96-8.48c-6.83-8.33-6.83-20.32,0-28.65l3.6-4.39,34,41.47Z"/>
    </svg>
  `.trim();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <title>Optified</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${C.bgOuter}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${C.textPrimary};">
    <!-- Preheader (inbox preview text) -->
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
      ${escapeHtml(preview)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${C.bgOuter};">
      <tr>
        <td align="center" style="padding: 40px 20px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">

            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom: 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right: 10px; vertical-align: middle;">
                      <div style="background: #ffffff; border-radius: 8px; width: 44px; height: 44px; text-align: center; line-height: 44px;">${markSvg}</div>
                    </td>
                    <td style="vertical-align: middle;">
                      <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Optified</span>
                      <span style="color: #BCBFCC; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; margin-left: 6px;">Medical</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Content card -->
            <tr>
              <td style="background: ${C.bgCard}; border-radius: 16px; padding: 40px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);">
                ${children}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top: 32px;">
                <p style="margin: 0 0 8px 0; color: #BCBFCC; font-size: 13px; line-height: 1.6;">
                  Optified Medical &middot; Conflict-free health optimization
                </p>
                <p style="margin: 0; color: #6E7180; font-size: 12px;">
                  Received this by mistake? You can safely ignore it.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Standard content primitives for use inside email templates.
 * Returns HTML strings so templates can compose them.
 */
export const e = {
  heading: (text: string) =>
    `<h1 style="margin: 0 0 16px 0; color: ${C.textPrimary}; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2;">${escapeHtml(
      text
    )}</h1>`,

  paragraph: (text: string) =>
    `<p style="margin: 0 0 16px 0; color: ${C.textSecondary}; font-size: 15px; line-height: 1.6;">${text}</p>`,

  /**
   * Primary CTA button. Styled as a solid navy button with cloud text.
   */
  button: (href: string, label: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px 0;">
       <tr>
         <td style="background: ${C.brand}; border-radius: 10px;" align="center">
           <a href="${escapeAttr(href)}" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: -0.01em;">${escapeHtml(
             label
           )}</a>
         </td>
       </tr>
     </table>`,

  divider: () =>
    `<div style="height: 1px; background: ${C.border}; margin: 24px 0;"></div>`,

  smallMuted: (text: string) =>
    `<p style="margin: 0; color: ${C.textMuted}; font-size: 13px; line-height: 1.5;">${text}</p>`,

  /**
   * Raw link rendered as plaintext so users can copy-paste if the button
   * is blocked by their email client.
   */
  codeLink: (href: string) =>
    `<p style="margin: 0 0 8px 0; color: ${C.textMuted}; font-size: 12px;">Or copy this link:</p>
     <p style="margin: 0; padding: 10px 12px; background: #F1F4FA; border-radius: 6px; font-size: 12px; color: ${C.textSecondary}; word-break: break-all; font-family: ui-monospace, 'SF Mono', Monaco, monospace;">${escapeHtml(
       href
     )}</p>`,
};

// ─── HTML-safe escaping ─────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str);
}
