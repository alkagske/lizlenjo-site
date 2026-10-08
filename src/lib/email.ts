/** Resend (https://resend.com). Without RESEND_API_KEY, emails are skipped and logged. */
export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(env: Pick<Env, 'RESEND_API_KEY' | 'MAIL_FROM'>, mail: Mail): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set: email skipped:', mail.subject);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Liz Lenjo <notes@lizlenjo.com>',
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text());
  return res.ok;
}

export const mailShell = (inner: string) => `<!doctype html><html><body style="margin:0;background:#fbfaf7;font-family:Georgia,serif;color:#14213d">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="font-family:monospace;font-size:11px;letter-spacing:.14em;color:#0c6b9d;text-transform:uppercase;border-bottom:1px dashed #14213d;padding-bottom:12px;margin-bottom:20px">lizlenjo.com</div>
${inner}
</div></body></html>`;
