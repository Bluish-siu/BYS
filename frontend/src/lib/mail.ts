// Server-only e-mail: verification codes and password-reset codes.
// Uses Gmail (or any SMTP server). Set SMTP_USER (the Gmail address) and SMTP_PASS (a Gmail "app password").
// MAIL_DEV=log prints e-mails to the server log instead of sending them (for local testing).
// With neither set, e-mail is off: accounts aren't verified, and an admin resets forgotten passwords.
import nodemailer from "nodemailer";

const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.replace(/\s+/g, ""); // Gmail shows app passwords in groups of four
export const mailMode: "smtp" | "log" | "off" = process.env.MAIL_DEV === "log" ? "log" : user && pass ? "smtp" : "off";
export const mailEnabled = mailMode !== "off";

const port = Number(process.env.SMTP_PORT ?? 465);
const transport = mailMode === "smtp"
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass } })
  : null;

const esc = (s: string) => s.replace(/[<>&"]/g, "");

/** Sends a short e-mail with a 6-digit code. Returns false if it couldn't be sent. */
export async function sendCode(to: string, name: string, code: string, purpose: "verify" | "reset") {
  const what = purpose === "verify" ? "confirm your email address" : "reset your password";
  const subject = purpose === "verify" ? `${code} is your PickMySeat code` : `${code} is your PickMySeat password reset code`;
  const text = `Hi ${name},\n\nUse ${code} to ${what}. It works for 10 minutes.\n\nIf this was not you, ignore this email.\n\nPickMySeat`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;color:#16161A">
    <p style="font-size:20px;font-weight:800;margin:0 0 16px">PickMy<span style="color:#FF5A36">Seat</span></p>
    <p>Hi ${esc(name)},</p><p>Use this code to ${what}:</p>
    <p style="font-size:32px;font-weight:800;letter-spacing:8px;background:#F3EEE5;padding:14px 0;text-align:center;border-radius:12px">${code}</p>
    <p style="color:#5B5A57;font-size:13px">It works for 10 minutes. If this was not you, you can ignore this email.</p></div>`;
  if (mailMode === "log") { console.log(`[mail] to ${to}: ${subject}`); return true; }
  if (!transport) return false;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM?.trim() || `PickMySeat <${user}>`, to, subject, text, html });
    return true;
  } catch (e) {
    console.error("mail failed:", (e as Error).message);
    return false;
  }
}
