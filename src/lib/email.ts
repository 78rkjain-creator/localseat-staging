import nodemailer from "nodemailer";

// ── Config check ──────────────────────────────────────────────────────────────

function smtpConfigured(): boolean {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`[email] Missing env vars: ${missing.join(", ")} — email sending skipped`);
    return false;
  }
  return true;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

const fromWelcome = () =>
  `"LocalSeat" <${process.env.SMTP_FROM_WELCOME ?? "hello@localseat.io"}>`;

const fromApprovals = () =>
  `"LocalSeat Approvals" <${process.env.SMTP_FROM_APPROVALS ?? "approvals@localseat.io"}>`;

const appUrl = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function formatRole(role?: string): string {
  if (!role) return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  name: string;
  email: string;
  campaignName?: string;
  role?: string;
  tempPassword?: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, campaignName, role, tempPassword } = params;
  const loginUrl = `${appUrl()}/login`;
  const roleLabel = formatRole(role);

  const campaignLine = campaignName
    ? `<p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        You've been added to the <strong style="color:#1e293b;">${campaignName}</strong> campaign
        ${roleLabel ? `as a <strong style="color:#1e293b;">${roleLabel}</strong>` : ""}.
       </p>`
    : `<p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your account is ready. Sign in to create or join a campaign.
       </p>`;

  const tempPasswordNote = tempPassword
    ? `<div style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Temporary password</p>
        <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#0f172a;font-family:monospace,monospace;letter-spacing:0.04em;">${tempPassword}</p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Sign in with this password and change it after your first login.</p>
       </div>`
    : role
    ? `<p style="margin:0 0 24px;color:#475569;line-height:1.6;">
        Use the temporary password provided by your campaign manager and change it after your first login.
       </p>`
    : `<p style="margin:0 0 24px;color:#475569;line-height:1.6;">
        Sign in with the password you created during registration.
       </p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Welcome to LocalSeat</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#f97316;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">Welcome, ${name}</h1>
      ${campaignLine}
      ${tempPasswordNote}

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#f97316;border-radius:10px;">
            <a href="${loginUrl}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Sign in to LocalSeat
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
        If you weren't expecting this email, you can safely ignore it.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: "Welcome to LocalSeat",
      html,
    });
    console.log(`[email] Welcome email sent to ${email}`);
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
  }
}

// ── Approval request email ────────────────────────────────────────────────────

export async function sendApprovalRequestEmail(params: {
  candidateName: string;
  candidateEmail: string;
  blastId: string;
  blastName: string;
  recipientCount: number;
  messagePreview: string;
  submittedBy: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const {
    candidateName,
    candidateEmail,
    blastId,
    blastName,
    recipientCount,
    messagePreview,
    submittedBy,
  } = params;

  const reviewUrl = `${appUrl()}/messaging/blasts/${blastId}/review`;
  const estimatedCost = (recipientCount * 0.01).toFixed(2);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Text Blast Pending Your Approval</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#fb923c;">Action required: text blast pending approval</p>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 20px;color:#475569;line-height:1.6;">
        Hi ${candidateName}, <strong style="color:#1e293b;">${submittedBy}</strong> has submitted a text blast for your approval.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Blast name</p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#0f172a;">${blastName}</p>

        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Message preview</p>
        <p style="margin:0;color:#334155;line-height:1.6;font-size:14px;white-space:pre-wrap;">${messagePreview}</p>
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0"
             style="width:100%;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;border-right:1px solid #e2e8f0;text-align:center;width:50%;">
            <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;">${recipientCount.toLocaleString()}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Recipients</p>
          </td>
          <td style="padding:16px 20px;text-align:center;width:50%;">
            <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;">$${estimatedCost}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Estimated cost</p>
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#16a34a;border-radius:10px;">
            <a href="${reviewUrl}?action=approve"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Approve
            </a>
          </td>
          <td style="width:10px;"></td>
          <td style="background:#dc2626;border-radius:10px;">
            <a href="${reviewUrl}?action=reject"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Reject
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">
        Or <a href="${reviewUrl}" style="color:#f97316;text-decoration:none;font-weight:500;">review in LocalSeat</a> for full details before deciding.
      </p>
    </div>

    <div style="padding:16px 32px;background:#fefce8;border-top:1px solid #fef08a;">
      <p style="margin:0;font-size:12px;color:#713f12;line-height:1.5;">
        <strong>Compliance reminder:</strong> The outgoing message will automatically include your candidate name and an opt-out instruction as required by Canadian anti-spam regulations.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromApprovals(),
      to: candidateEmail,
      subject: "Text Blast Pending Your Approval",
      html,
    });
    console.log(`[email] Approval request email sent to ${candidateEmail}`);
  } catch (err) {
    console.error("[email] Failed to send approval request email:", err);
  }
}

// ── Password reset email ──────────────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
  name: string;
  email: string;
  token: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, token } = params;
  const resetUrl = `${appUrl()}/reset-password?token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reset your LocalSeat password</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#f97316;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;">Reset your password</h1>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">Hi ${name},</p>
      <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
        A password reset was requested for your LocalSeat account. Click the button below to set a new password.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f97316;border-radius:10px;">
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Reset password
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;">
        This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: "Reset your LocalSeat password",
      html,
    });
    console.log(`[email] Password reset email sent to ${email}`);
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
  }
}

// ── Verification email ────────────────────────────────────────────────────────

export async function sendVerificationEmail(params: {
  name: string;
  email: string;
  token: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, token } = params;
  const verifyUrl = `${appUrl()}/verify-email?token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Verify your LocalSeat account</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#f97316;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;">Verify your email address</h1>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">Hi ${name},</p>
      <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
        Click the button below to verify your email address and activate your LocalSeat account.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f97316;border-radius:10px;">
            <a href="${verifyUrl}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Verify email address
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;">
        This link expires in <strong>14 days</strong>. If you don't verify before then, you'll need to re-register.
      </p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
        If you didn't create a LocalSeat account, you can safely ignore this email.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: "Verify your LocalSeat account",
      html,
    });
    console.log(`[email] Verification email sent to ${email}`);
  } catch (err) {
    console.error("[email] Failed to send verification email:", err);
  }
}

// ── Support access request email ──────────────────────────────────────────────

export async function sendSupportAccessRequestEmail(params: {
  recipientEmail: string;
  campaignName:   string;
  requesterName:  string;
  note:           string | null;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { recipientEmail, campaignName, requesterName, note } = params;
  const settingsUrl = `${appUrl()}/campaign-settings/general`;

  const noteBlock = note
    ? `<div style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Note from support</p>
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${note}</p>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>LocalSeat support is requesting access to your campaign</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#fb923c;">Support access request</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;">Action required</h1>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        <strong style="color:#1e293b;">${requesterName}</strong> from the LocalSeat support team has requested
        temporary editing access to your campaign <strong style="color:#1e293b;">${campaignName}</strong>.
      </p>
      <p style="margin:0 0 20px;color:#475569;line-height:1.6;">
        If approved, access will be limited to <strong>72 hours</strong> and all actions taken by the support team
        will be recorded in your campaign audit log.
      </p>

      ${noteBlock}

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f97316;border-radius:10px;">
            <a href="${settingsUrl}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Review request in settings
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
        Log in to your campaign settings to approve or deny this request. You can also revoke access at any time after approval.
        If you were not expecting this request, you can safely deny it.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    fromWelcome(),
      to:      recipientEmail,
      subject: "LocalSeat support is requesting access to your campaign",
      html,
    });
    console.log(`[email] Support access request email sent to ${recipientEmail}`);
  } catch (err) {
    console.error("[email] Failed to send support access request email:", err);
  }
}

// ── Contact notification email ────────────────────────────────────────────────

export async function sendContactNotificationEmail(params: {
  firstName: string;
  lastName:  string;
  email:     string;
  topic?:    string;
  message:   string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { firstName, lastName, email, topic, message } = params;
  const subject = `New contact: ${topic || "General"} — ${firstName} ${lastName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#f97316;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">New contact form submission</p>
    </div>

    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:110px;vertical-align:top;">
            <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Name</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <span style="font-size:14px;color:#0f172a;font-weight:500;">${firstName} ${lastName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Email</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <a href="mailto:${email}" style="font-size:14px;color:#f97316;text-decoration:none;">${email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;vertical-align:top;">
            <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Topic</span>
          </td>
          <td style="padding:10px 0;vertical-align:top;">
            <span style="font-size:14px;color:#0f172a;">${topic || "General"}</span>
          </td>
        </tr>
      </table>

      <div>
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Message</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</p>
        </div>
      </div>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        Replying to this email will go directly to ${email}.
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:     fromWelcome(),
      to:       "info@localseat.io",
      replyTo:  email,
      subject,
      html,
    });
    console.log(`[email] Contact notification sent for ${email}`);
  } catch (err) {
    console.error("[email] Failed to send contact notification email:", err);
  }
}

// ── Bug report email ─────────────────────────────────────────────────────────

export async function sendBugReportEmail(params: {
  reporterName: string;
  reporterEmail: string;
  role: string;
  campaignName: string;
  campaignId: string;
  severity: string;
  description: string;
  currentUrl: string;
  userAgent: string;
  timestamp: string;
  screenshot: { buffer: Buffer; name: string; type: string } | null;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const {
    reporterName, reporterEmail, role, campaignName, campaignId,
    severity, description, currentUrl, userAgent, timestamp, screenshot,
  } = params;

  const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
  const severityColor =
    severity === "blocking" ? "#dc2626" :
    severity === "major"    ? "#d97706" :
                              "#475569";

  const subject = `[${severityLabel}] Bug Report — ${reporterName}`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="padding:24px 32px;border-bottom:1px solid #f1f5f9;">
      <h1 style="margin:0;font-size:18px;color:#0f172a;">Bug Report</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#64748b;">${timestamp}</p>
    </div>

    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#64748b;width:120px;vertical-align:top;">Severity</td>
          <td style="padding:8px 0;color:${severityColor};font-weight:600;">${severityLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;vertical-align:top;">Reported by</td>
          <td style="padding:8px 0;color:#0f172a;">${reporterName} (${reporterEmail})</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;vertical-align:top;">Role</td>
          <td style="padding:8px 0;color:#0f172a;">${formatRole(role)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;vertical-align:top;">Campaign</td>
          <td style="padding:8px 0;color:#0f172a;">${campaignName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;vertical-align:top;">Campaign ID</td>
          <td style="padding:8px 0;color:#0f172a;font-family:monospace;font-size:12px;">${campaignId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;vertical-align:top;">Page</td>
          <td style="padding:8px 0;color:#0f172a;word-break:break-all;">${currentUrl}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;vertical-align:top;">Device</td>
          <td style="padding:8px 0;color:#64748b;font-size:12px;word-break:break-all;">${userAgent}</td>
        </tr>
      </table>

      <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Description</p>
        <p style="margin:0;font-size:14px;color:#0f172a;white-space:pre-wrap;line-height:1.6;">${description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>

      ${screenshot ? '<p style="margin-top:16px;font-size:13px;color:#64748b;">📎 Screenshot attached</p>' : ""}
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    fromWelcome(),
      to:      "rahul@localseat.io",
      replyTo: reporterEmail,
      subject,
      html,
      ...(screenshot
        ? {
            attachments: [
              {
                filename: screenshot.name,
                content:  screenshot.buffer,
                contentType: screenshot.type,
              },
            ],
          }
        : {}),
    });
    console.log(`[email] Bug report sent from ${reporterEmail} (${severity})`);
  } catch (err) {
    console.error("[email] Failed to send bug report email:", err);
    throw err;
  }
}

// ── Lead follow-up email ──────────────────────────────────────────────────────

export async function sendLeadFollowUpEmail(params: {
  firstName: string;
  email: string;
}): Promise<boolean> {
  if (!smtpConfigured()) return false;

  const { firstName, email } = params;
  const registerUrl = `${appUrl()}/register`;
  const demoUrl = process.env.DEMO_SITE_URL ?? "https://demo.localseat.io";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Getting started with LocalSeat</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#f97316;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${firstName},</h1>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        Thanks for your interest in LocalSeat. We noticed you signed up recently — that's great.
      </p>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        LocalSeat is built for Canadian municipal campaigns. It helps you manage your voter contacts, run door-to-door canvassing, track lawn sign requests, and keep your team organized — all from your phone or computer.
      </p>

      <div style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0f172a;">What you can do with LocalSeat:</p>
        <p style="margin:0 0 6px;color:#475569;font-size:14px;line-height:1.6;">• Import your voter list and organize by household</p>
        <p style="margin:0 0 6px;color:#475569;font-size:14px;line-height:1.6;">• Create walk lists and assign canvassers</p>
        <p style="margin:0 0 6px;color:#475569;font-size:14px;line-height:1.6;">• Record support levels door-to-door on any phone</p>
        <p style="margin:0 0 6px;color:#475569;font-size:14px;line-height:1.6;">• Track lawn signs, volunteers, and donor interest</p>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">• See your campaign progress on a live dashboard</p>
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="background:#f97316;border-radius:10px;">
            <a href="${registerUrl}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Create your campaign
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;color:#64748b;font-size:13px;line-height:1.5;">
        Or <a href="${demoUrl}" style="color:#f97316;text-decoration:none;font-weight:500;">try the demo</a> first — no account needed.
      </p>

      <p style="margin:0;color:#475569;line-height:1.6;">
        If you have questions or need help getting started, just reply to this email. We're happy to help.
      </p>
      <p style="margin:20px 0 0;color:#0f172a;font-weight:500;line-height:1.6;">
        Rahul Jain
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: "Getting started with LocalSeat",
      html,
    });
    console.log(`[email] Lead follow-up email sent to ${email}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send lead follow-up email:", err);
    return false;
  }
}

// ── Lead follow-up daily summary ──────────────────────────────────────────────

export async function sendLeadFollowUpSummary(params: {
  sent: { name: string; email: string }[];
  failed: { name: string; email: string }[];
  date: Date;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { sent, failed, date } = params;
  const dateLabel = date.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const total = sent.length + failed.length;

  const sentRows = sent.length > 0
    ? sent.map((l) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${l.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">${l.email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#16a34a;">Sent</td>
        </tr>`
      ).join("")
    : "";

  const failedRows = failed.length > 0
    ? failed.map((l) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${l.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#475569;">${l.email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#dc2626;">Failed</td>
        </tr>`
      ).join("")
    : "";

  const tableRows = sentRows + failedRows;

  const noLeadsMessage = total === 0
    ? `<p style="margin:0 0 16px;color:#475569;line-height:1.6;">No new leads registered on ${dateLabel}. The follow-up job ran successfully — there was just nothing to send.</p>`
    : "";

  const statsBlock = total > 0
    ? `<div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:600;color:#16a34a;">${sent.length}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#15803d;">Sent</p>
        </div>
        <div style="flex:1;background:${failed.length > 0 ? '#fef2f2' : '#f8fafc'};border-radius:10px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:600;color:${failed.length > 0 ? '#dc2626' : '#94a3b8'};">${failed.length}</p>
          <p style="margin:4px 0 0;font-size:12px;color:${failed.length > 0 ? '#991b1b' : '#94a3b8'};">Failed</p>
        </div>
      </div>`
    : "";

  const tableBlock = total > 0
    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Name</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Email</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Lead follow-up summary</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#fb923c;">Lead follow-up summary</p>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">${dateLabel}</p>
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">
        ${total === 0 ? "No follow-ups today" : `${total} follow-up${total === 1 ? "" : "s"} processed`}
      </h1>

      ${noLeadsMessage}
      ${statsBlock}
      ${tableBlock}
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        Automated daily summary &mdash; <a href="${appUrl()}/admin/demo-leads" style="color:#f97316;text-decoration:none;">View all leads</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  const subject = total === 0
    ? `Lead follow-up: no new leads — ${dateLabel}`
    : `Lead follow-up: ${sent.length} sent${failed.length > 0 ? `, ${failed.length} failed` : ""} — ${dateLabel}`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: "info@localseat.io",
      subject,
      html,
    });
    console.log(`[email] Lead follow-up summary sent to info@localseat.io`);
  } catch (err) {
    console.error("[email] Failed to send lead follow-up summary:", err);
  }
}

// ── Payment warning email ────────────────────────────────────────────────────

export async function sendPaymentWarningEmail(params: {
  name: string;
  email: string;
  campaignName: string;
  daysRemaining: number;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, campaignName, daysRemaining } = params;
  const dayWord = daysRemaining === 1 ? "day" : "days";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Payment reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#f97316;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">Payment reminder</h1>

      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Hi ${name},
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your payment for <strong style="color:#1e293b;">${campaignName}</strong> has not been received yet.
        You have <strong style="color:#dc2626;">${daysRemaining} ${dayWord}</strong> remaining before your account is suspended.
      </p>
      <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
        If your payment is still processing through your bank, no action is needed. Once we receive confirmation from your bank, your account will remain active.
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        If there is an issue with your payment, please contact us at <a href="mailto:info@localseat.io" style="color:#f97316;">info@localseat.io</a>.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: `Payment reminder: ${daysRemaining} ${dayWord} remaining - ${campaignName}`,
      html,
    });
    console.log(`[email] Payment warning sent to ${email} (${daysRemaining} days remaining)`);
  } catch (err) {
    console.error("[email] Failed to send payment warning:", err);
  }
}

// ── Payment suspended email ──────────────────────────────────────────────────

export async function sendPaymentSuspendedEmail(params: {
  name: string;
  email: string;
  campaignName: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, campaignName } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Account suspended</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#dc2626;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">Account suspended</h1>

      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Hi ${name},
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your payment for <strong style="color:#1e293b;">${campaignName}</strong> was not received within the required timeframe.
        Your campaign account has been suspended.
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your campaign data has not been deleted and will be restored once payment is confirmed. If your payment is still being processed by your bank, your account will be reactivated automatically when we receive confirmation.
      </p>
      <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
        If you need help, contact us at <a href="mailto:info@localseat.io" style="color:#f97316;">info@localseat.io</a>.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: `Account suspended - ${campaignName}`,
      html,
    });
    console.log(`[email] Payment suspended email sent to ${email}`);
  } catch (err) {
    console.error("[email] Failed to send payment suspended email:", err);
  }
}

// ── Payment received email ───────────────────────────────────────────────────

export async function sendPaymentReceivedEmail(params: {
  name: string;
  email: string;
  campaignName: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, campaignName } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Payment confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#16a34a;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">Payment confirmed</h1>

      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Hi ${name},
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your payment for <strong style="color:#1e293b;">${campaignName}</strong> has been received and confirmed. Your campaign account is fully active.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#16a34a;border-radius:10px;">
            <a href="${appUrl()}/dashboard"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Go to dashboard
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: `Payment confirmed - ${campaignName}`,
      html,
    });
    console.log(`[email] Payment received email sent to ${email}`);
  } catch (err) {
    console.error("[email] Failed to send payment received email:", err);
  }
}

// ── Payment failed email ─────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(params: {
  name: string;
  email: string;
  campaignName: string;
}): Promise<void> {
  if (!smtpConfigured()) return;

  const { name, email, campaignName } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Payment failed</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

    <div style="background:#dc2626;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LocalSeat</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Municipal campaign platform</p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0f172a;">Payment failed</h1>

      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Hi ${name},
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your payment for <strong style="color:#1e293b;">${campaignName}</strong> could not be processed. Your campaign account has been suspended.
      </p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">
        Your campaign data has not been deleted. Please contact us at <a href="mailto:info@localseat.io" style="color:#f97316;">info@localseat.io</a> to arrange payment and reactivate your account.
      </p>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        The LocalSeat Team &mdash; Built for Canadian municipal campaigns
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromWelcome(),
      to: email,
      subject: `Payment failed - ${campaignName}`,
      html,
    });
    console.log(`[email] Payment failed email sent to ${email}`);
  } catch (err) {
    console.error("[email] Failed to send payment failed email:", err);
  }
}
