export interface SendEmailResult {
  delivered: boolean;
  devResetUrl?: string;
  reason?: "EMAIL_NOT_CONFIGURED" | "PROVIDER_ERROR" | "NO_RECIPIENTS";
}

export type SendResetEmailResult = SendEmailResult;

const DEFAULT_FROM_EMAIL =
  "The NUESA Library <noreply@nuesalibrary.fuoye.edu.ng>";

function resolveAppOrigin(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM_EMAIL;
}

/**
 * Returns configured emails that should receive moderation alerts when a new
 * student upload enters the review queue (`MODERATOR_ALERT_EMAILS`).
 */
export function getModeratorAlertRecipients(): string[] {
  const raw = process.env.MODERATOR_ALERT_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

async function sendResendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  devLogLabel: string;
  devResetUrl?: string;
}): Promise<SendEmailResult> {
  if (params.to.length === 0) {
    return { delivered: false, reason: "NO_RECIPIENTS" };
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = getFromEmail();

  if (!resendApiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[DEV EMAIL: ${params.devLogLabel}] To: ${params.to.join(", ")} | Subject: ${params.subject}`);
      return {
        delivered: true,
        ...(params.devResetUrl ? { devResetUrl: params.devResetUrl } : {}),
      };
    }
    return {
      delivered: false,
      reason: "EMAIL_NOT_CONFIGURED",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
      // Never let a stalled Resend API hang the request handler.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Resend email error (${params.devLogLabel}):`, res.status, errText);
      return { delivered: false, reason: "PROVIDER_ERROR" };
    }

    return { delivered: true };
  } catch (err) {
    console.error(`Failed to send ${params.devLogLabel} email:`, err);
    return { delivered: false, reason: "PROVIDER_ERROR" };
  }
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  userName: string;
  resetUrl: string;
}): Promise<SendResetEmailResult> {
  return sendResendEmail({
    to: [params.toEmail],
    subject: "Reset your password — The NUESA Library",
    devLogLabel: `PASSWORD RESET (${params.resetUrl})`,
    devResetUrl: params.resetUrl,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <h2 style="margin: 0 0 12px; color: #0C3B2E;">The NUESA Library Password Reset</h2>
        <p style="margin: 0 0 16px; line-height: 1.6;">Hi ${escapeHtml(params.userName)},</p>
        <p style="margin: 0 0 20px; line-height: 1.6;">
          We received a request to reset your password for <strong>The NUESA Library</strong>. This single-use link expires in <strong>15 minutes</strong>.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${escapeHtml(params.resetUrl)}" style="display: inline-block; background: #00875A; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">
            Reset Password
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          If you did not request this reset, you can safely ignore this email. Your existing password remains unchanged.
        </p>
      </div>
    `,
  });
}

export async function sendModerationStatusEmail(params: {
  toEmail: string;
  userName: string;
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}): Promise<SendEmailResult> {
  const origin = resolveAppOrigin();
  const isApproved = params.status === "APPROVED";
  const actionUrl = isApproved
    ? `${origin}/resources/${encodeURIComponent(params.resourceId)}`
    : `${origin}/profile`;
  const subject = isApproved
    ? `Published: ${params.courseCode} — ${params.resourceTitle} | The NUESA Library`
    : `Action needed on your submission (${params.courseCode}) | The NUESA Library`;

  const bodyCopy = isApproved
    ? `
      <p style="margin: 0 0 16px; line-height: 1.6;">
        Great news! Your contribution <strong>${escapeHtml(params.resourceTitle)}</strong> (<code>${escapeHtml(params.courseCode)}</code>) has been verified by faculty moderators and is now live in <strong>The NUESA Library</strong>.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${escapeHtml(actionUrl)}" style="display: inline-block; background: #00875A; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">
          View Published Resource
        </a>
      </p>
    `
    : `
      <p style="margin: 0 0 16px; line-height: 1.6;">
        Your recent submission <strong>${escapeHtml(params.resourceTitle)}</strong> (<code>${escapeHtml(params.courseCode)}</code>) was reviewed by faculty moderators and could not be published as submitted.
      </p>
      ${
        params.rejectionReason
          ? `<div style="margin: 0 0 20px; padding: 14px 16px; border-radius: 10px; background: #FFF1F2; border: 1px solid #FECDD3; color: #9F1239; font-size: 14px; line-height: 1.5;">
               <strong>Moderator feedback:</strong> ${escapeHtml(params.rejectionReason)}
             </div>`
          : ""
      }
      <p style="margin: 0 0 24px;">
        <a href="${escapeHtml(actionUrl)}" style="display: inline-block; background: #0C3B2E; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">
          Review My Submissions
        </a>
      </p>
    `;

  return sendResendEmail({
    to: [params.toEmail],
    subject,
    devLogLabel: `MODERATION ${params.status} (${params.courseCode})`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <h2 style="margin: 0 0 12px; color: #0C3B2E;">
          ${isApproved ? "Submission Approved & Published" : "Submission Review Update"}
        </h2>
        <p style="margin: 0 0 16px; line-height: 1.6;">Hi ${escapeHtml(params.userName)},</p>
        ${bodyCopy}
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          Thank you for contributing to the FUOYE Faculty of Engineering digital archive — The NUESA Library.
        </p>
      </div>
    `,
  });
}

export async function sendNewSubmissionAlertEmail(params: {
  resourceTitle: string;
  courseCode: string;
  department: string;
  medium: "PDF" | "YOUTUBE";
  uploaderEmail?: string;
}): Promise<SendEmailResult> {
  const recipients = getModeratorAlertRecipients();
  if (recipients.length === 0) {
    return { delivered: false, reason: "NO_RECIPIENTS" };
  }

  const origin = resolveAppOrigin();
  const moderationUrl = `${origin}/moderation`;

  return sendResendEmail({
    to: recipients,
    subject: `New submission awaiting review: ${params.courseCode} — ${params.resourceTitle}`,
    devLogLabel: `NEW SUBMISSION ALERT (${params.courseCode})`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <h2 style="margin: 0 0 12px; color: #0C3B2E;">New Material Awaiting Moderation</h2>
        <p style="margin: 0 0 16px; line-height: 1.6;">
          A new <strong>${escapeHtml(params.medium === "YOUTUBE" ? "YouTube Video Tutorial" : "Document")}</strong> has been submitted to The NUESA Library review queue:
        </p>
        <div style="margin: 0 0 20px; padding: 14px 16px; border-radius: 10px; background: #F8FAFC; border: 1px solid #E2E8F0; font-size: 14px; line-height: 1.6;">
          <div><strong>Course:</strong> ${escapeHtml(params.courseCode)}</div>
          <div><strong>Title:</strong> ${escapeHtml(params.resourceTitle)}</div>
          <div><strong>Department:</strong> ${escapeHtml(params.department)}</div>
          ${params.uploaderEmail ? `<div><strong>Contributor:</strong> ${escapeHtml(params.uploaderEmail)}</div>` : ""}
        </div>
        <p style="margin: 0;">
          <a href="${escapeHtml(moderationUrl)}" style="display: inline-block; background: #00875A; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">
            Open Moderation Queue
          </a>
        </p>
      </div>
    `,
  });
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
