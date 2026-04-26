const nodemailer = require("nodemailer");

let etherealTestAccount = null;

/**
 * Send achievement email when user earns a new badge.
 * - If MAIL_HOST + MAIL_USER + MAIL_PASS are set: sends via SMTP.
 * - Else if MAIL_USE_ETHEREAL=true: sends to Ethereal test inbox and logs preview URL.
 * - Else: logs that email would have been sent and how to enable it.
 * @param {{ email: string, name: string }} user
 * @param {{ name: string, icon: string, points: number }} badge
 * @param {number} score - user's current total points
 */
async function sendAchievementEmail(user, badge, score) {
  const from = process.env.MAIL_FROM || (process.env.MAIL_USER ? `igniUp <${process.env.MAIL_USER}>` : "igniUp <noreply@igniup.local>");
  const subject = `Congratulations! You earned the "${badge.name}" badge on igniUp`;
  const text = [
    `Hi ${user.name},`,
    "",
    `Congratulations! You've earned a new badge on igniUp.`,
    "",
    `Badge: ${badge.icon} ${badge.name}`,
    `Your current score: ${score} points`,
    "",
    "Keep coding!",
    "— igniUp",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(user.name)},</p>`,
    "<p><strong>Congratulations!</strong> You've earned a new badge on igniUp.</p>",
    `<p><strong>Badge:</strong> ${escapeHtml(badge.icon)} ${escapeHtml(badge.name)}</p>`,
    `<p><strong>Your current score:</strong> ${score} points</p>`,
    "<p>Keep coding!<br>— igniUp</p>",
  ].join("");

  const mailOptions = { from, to: user.email, subject, text, html };

  const hasSmtp = process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS;
  const useEthereal = process.env.MAIL_USE_ETHEREAL === "true" || process.env.MAIL_USE_ETHEREAL === "1";

  if (hasSmtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT || "587", 10),
        secure: process.env.MAIL_SECURE === "true",
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });
      await transporter.sendMail(mailOptions);
      console.log("[Email] Achievement email sent to", user.email, "for badge:", badge.name);
    } catch (err) {
      console.error("[Email] Failed to send achievement email:", err.message);
    }
    return;
  }

  if (useEthereal) {
    try {
      if (!etherealTestAccount) {
        etherealTestAccount = await nodemailer.createTestAccount();
      }
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: etherealTestAccount.user, pass: etherealTestAccount.pass },
      });
      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("[Email] Achievement email sent (Ethereal test). Preview:", previewUrl || "check Ethereal inbox");
    } catch (err) {
      console.error("[Email] Ethereal send failed:", err.message);
    }
    return;
  }

  console.log(
    "[Email] No mail sent (SMTP not configured). Achievement would have been sent to:",
    user.email,
    "| Badge:",
    badge.name,
    "| Score:",
    score
  );
  console.log(
    "[Email] To enable: set MAIL_HOST, MAIL_USER, MAIL_PASS in server/.env — or set MAIL_USE_ETHEREAL=true to use test inbox (see README)."
  );
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { sendAchievementEmail };
