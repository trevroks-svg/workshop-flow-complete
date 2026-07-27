/**
 * server/email.js
 *
 * Thin wrapper around Resend for transactional email.
 * Replace base44's: base44.asServiceRole.integrations.Core.SendEmail()
 *
 * Sign up at https://resend.com — free tier is 3,000 emails/month.
 * Set RESEND_API_KEY and FROM_EMAIL in your environment.
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.FROM_EMAIL || 'Workshop Flow <noreply@yourdomain.com>';

/**
 * Send a plain-text email.
 *
 * @param {{ to: string, subject: string, body: string }} opts
 */
export async function sendEmail({ to, subject, body }) {
  if (!resend) {
    console.warn(`Email not sent to ${to}: RESEND_API_KEY is not configured`);
    return { skipped: true, error: 'Email is not configured' };
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    text: body,
  });

  if (error) {
    console.error('Email send error:', error);
    throw new Error(`Failed to send email to ${to}: ${error.message}`);
  }
}
