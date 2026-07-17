import multer from 'multer';
import { env } from '../config/env.js';
import { isKnownMimeType } from '../lib/storage.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxFileSizeKb * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isKnownMimeType(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype);
    if (!ok) return cb(new Error(`Expected a CSV file, got: ${file.mimetype}`));
    cb(null, true);
  },
});