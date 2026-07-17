import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { studentRouter } from './routes/student.js';
import { adminRouter } from './routes/admin.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.appBaseUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Global rate limit as a backstop; OTP-specific limiting is stricter (see lib/otp.js).
// app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/student', studentRouter);
app.use('/api/admin', adminRouter);

// Multer / general error handler — keep last.
app.use((err, req, res, next) => {
  if (err?.message?.startsWith('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max ${env.upload.maxFileSizeMb}MB.` });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Student document portal listening on port ${env.port}`);
});
