/** Sends email through the Email Sending binding (FRIDGE_MAIL), from <local>@<site hostname>. */
import type { Env } from "./env.ts";

export interface Mail {
  from: { name: string; local: string };
  /** Defaults to Dan (the FRIDGE_NOTIFY_TO secret). */
  to?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

/** Returns false (and logs) when email isn't configured, so callers can carry on without it. */
export async function sendMail(env: Env, mail: Mail): Promise<boolean> {
  const to = mail.to ?? env.FRIDGE_NOTIFY_TO;
  if (!env.FRIDGE_MAIL || !to) {
    console.warn("[mail] email not configured (FRIDGE_MAIL binding / FRIDGE_NOTIFY_TO secret); skipped:", mail.subject);
    return false;
  }
  await env.FRIDGE_MAIL.send({
    from: { name: mail.from.name, email: `${mail.from.local}@${new URL(env.SITE_URL).hostname}` },
    to,
    ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return true;
}

/** A pill button for HTML emails. `href` and `label` must already be safe. */
export const mailButton = (href: string, label: string, bg: string) =>
  `<a href="${href}" style="display:inline-block;padding:10px 16px;margin-right:8px;border:3px solid #2b1d14;border-radius:6px;background:${bg};color:#2b1d14;font-weight:700;text-decoration:none">${label}</a>`;
