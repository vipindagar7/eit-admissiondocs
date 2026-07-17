import { makeOtpChannel } from './otpCore.js';
import { sendEmail, buildStaffOtpMessage } from './mailer.js';

// Staff/admin 2nd-factor OTP channel — delivered via email.
const channel = makeOtpChannel('staff-email');

export async function requestStaffOtp(email) {
  await channel.request(email, (otp) =>
    sendEmail(email, 'Your EIT Portal login code', buildStaffOtpMessage(otp))
  );
}

export async function verifyStaffOtp(email, submittedOtp) {
  await channel.verify(email, submittedOtp);
}
