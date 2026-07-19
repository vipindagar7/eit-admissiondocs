import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { studentRouter } from './routes/student.js';
import { adminRouter } from './routes/admin.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.appBaseUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Global rate limit as a backstop; OTP-specific limiting is stricter (see lib/otp.js).
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/student', studentRouter);
app.use('/api/admin', adminRouter);

// Multer / general error handler — keep last. Multer's fileFilter and
// size-limit rejections happen BEFORE our route handlers run, so this is
// the only place to catch and log them — req.student is already set by
// requireStudentAuth (which runs before the upload middleware) if this
// came from a student upload attempt.
app.use(async (err, req, res, next) => {
  const isFileTypeError = err?.message?.startsWith('File type not allowed') || err?.message?.startsWith('Expected a CSV file');
  const isSizeError = err?.code === 'LIMIT_FILE_SIZE';

  if ((isFileTypeError || isSizeError) && req.student?.id && req.params?.documentTypeId) {
    const message = isSizeError
      ? `File too large. Server-wide max is ${env.upload.maxFileSizeKb}KB (the per-document limit set by admin may be even smaller).`
      : err.message;
    try {
      await prisma.uploadAttemptLog.create({
        data: {
          studentId: req.student.id,
          documentTypeId: req.params.documentTypeId,
          errorMessage: message,
        },
      });
    } catch (logErr) {
      console.error('[upload-attempt-log]', logErr);
    }
  }

  if (isFileTypeError) {
    return res.status(400).json({ error: err.message });
  }
  if (isSizeError) {
    return res.status(413).json({ error: `File too large. Max ${env.upload.maxFileSizeKb}KB.` });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Student document portal listening on port ${env.port}`);
});