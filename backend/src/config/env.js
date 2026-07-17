import 'dotenv/config';

function required(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export const env = {
  port: process.env.PORT || 3007,
  nodeEnv: process.env.NODE_ENV || 'development',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:4000',

  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  jwt: {
    studentSecret: required('JWT_STUDENT_SECRET'),
    staffSecret: required('JWT_STAFF_SECRET'),
    studentExpiry: process.env.JWT_STUDENT_EXPIRY || '30m',
    staffExpiry: process.env.JWT_STAFF_EXPIRY || '8h',
  },

  otp: {
    length: Number(process.env.OTP_LENGTH || 6),
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
    maxRequestsPerWindow: Number(process.env.OTP_MAX_REQUESTS_PER_WINDOW || 3),
    requestWindowSeconds: Number(process.env.OTP_REQUEST_WINDOW_SECONDS || 600),
    maxVerifyAttempts: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5),
  },

  sms: {
    apiUrl: process.env.SMS_API_URL,
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID || 'ALERT',
  },

  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    // Note: sheetId/sheetRange are no longer global — each Session row in the
    // DB carries its own sheetId, set by admin via the settings UI.
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'EIT Document Portal <no-reply@eitfaridabad.com>',
  },

  upload: {
    root: process.env.UPLOAD_ROOT || './uploads',
    maxFileSizeKb: Number(process.env.MAX_FILE_SIZE_KB || 20480), // hard ceiling (20MB); per-DocumentType limits are stricter and enforced in-route
  },
};