import { makeOtpChannel } from './otpCore.js';
import { sendSms, buildOtpMessage } from './sms.js';

// Student login OTP channel — delivered via SMS to their registered phone.
const channel = makeOtpChannel('student-mobile');

export async function requestOtp(phone) {
  await channel.request(phone, (otp) => sendSms(phone, otp));
}

export async function verifyOtp(phone, submittedOtp) {
  await channel.verify(phone, submittedOtp);
}
