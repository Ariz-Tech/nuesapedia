export interface SendResetEmailResult {
  delivered: boolean;
  devResetUrl?: string;
  reason?: "EMAIL_NOT_CONFIGURED" | "PROVIDER_ERROR";
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  userName: string;
  resetUrl: string;
}): Promise<SendResetEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.EMAIL_FROM?.trim() || "NUESApedia <noreply@nuesapedia.org>";

  if (!resendApiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[DEV PASSWORD RESET] Reset link for ${params.toEmail}: ${params.resetUrl}`
      );
      return {
        delivered: true,
        devResetUrl: params.resetUrl,
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
        to: [params.toEmail],
        subject: "Reset your NUESApedia password",
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
            <h2 style="margin: 0 0 12px; color: #065f46;">NUESApedia Password Reset</h2>
            <p style="margin: 0 0 16px; line-height: 1.6;">Hi ${escapeHtml(params.userName)},</p>
            <p style="margin: 0 0 20px; line-height: 1.6;">
              We received a request to reset your NUESApedia password. This single-use link expires in <strong>15 minutes</strong>.
            </p>
            <p style="margin: 0 0 24px;">
              <a href="${escapeHtml(params.resetUrl)}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">
                Reset Password
              </a>
            </p>
            <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
              If you did not request this reset, you can safely ignore this email. Your existing password remains unchanged.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Resend email error:", res.status, errText);
      return { delivered: false, reason: "PROVIDER_ERROR" };
    }

    return { delivered: true };
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return { delivered: false, reason: "PROVIDER_ERROR" };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

