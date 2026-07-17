import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

export async function sendEmail(to, subject, text) {
  if (env.nodeEnv === 'development' && !env.smtp.host) {
    console.log(`[email:dev-stub] to=${to} subject="${subject}" body="${text}"`);
    return;
  }

  await getTransporter().sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
  });
}

export function buildStaffOtpMessage(otp) {
  return `${otp} is your login verification code for the EIT Document Portal. Valid for 5 minutes. Do not share this with anyone.`;
}
