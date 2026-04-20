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
