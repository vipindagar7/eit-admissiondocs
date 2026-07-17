import { env } from '../config/env.js';


export const sendSms = async (contact, otp) => {
  try {
    const message = `Thank you for registering. Your OTP is ${otp}. Echelon Institute of Technology! Visit www.eitfaridabad.com or call +919999753763 for more updates.`;

    const params = new URLSearchParams({
      user: process.env.SMS_USER,
      password: process.env.SMS_PASS,
      senderid: process.env.SENDER_ID,
      channel: "Trans",
      DCS: "0",
      flashsms: "0",
      number: `91${contact}`,
      text: message,
      route: "4",
    });

    const response = await fetch(
      `http://bulksms.saakshisoftware.in/api/mt/SendSMS?${params.toString()}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.text(); // SMS APIs usually return plain text

    console.log("SMS Response:", data);
    return data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw new Error("Failed to send OTP");
  }
};
export function buildOtpMessage(otp) {
  return `${otp} is your OTP for the EIT Document Portal. Valid for 5 minutes. Do not share this with anyone.`;
}
