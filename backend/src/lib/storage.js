import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

// The universe of file types this system knows how to verify by magic
// bytes. A DocumentType's allowedMimeTypes is always a subset of this.
const ALLOWED_TYPES = {
  'application/pdf': { ext: '.pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  'image/jpeg': { ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png': { ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
};

export function isKnownMimeType(mimeType) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, mimeType);
}

/**
 * Validates a file against a specific DocumentType's own rules (which
 * subset of mime types it accepts, and its own max size) — not just the
 * system-wide universe. Returns { ok: true } or { ok: false, error }.
 */
export function validateAgainstDocumentType(docType, { mimeType, sizeBytes }) {
  const allowed = docType.allowedMimeTypes.split(',').map((s) => s.trim());
  if (!allowed.includes(mimeType)) {
    return { ok: false, error: `This document only accepts: ${allowed.join(', ')}` };
  }
  const maxBytes = docType.maxSizeKB * 1024;
  if (sizeBytes > maxBytes) {
    return { ok: false, error: `File exceeds the ${docType.maxSizeKB}KB limit for this document` };
  }
  return { ok: true };
}

/** Reads the first few bytes of a buffer and confirms they match the claimed mime type. */
export function verifyMagicBytes(buffer, mimeType) {
  const spec = ALLOWED_TYPES[mimeType];
  if (!spec) return false;
  return spec.magic.every((byte, i) => buffer[i] === byte);
}

function studentDir(sessionId, admissionNo) {
  // sessionId (a UUID) and admissionNo (validated alphanumeric) are both
  // safe path segments — see validateAdmissionNoSafe() — so this can't
  // be used for path traversal. Session-scoped because admissionNo is
  // only unique *within* a session, not globally.
  return path.join(env.upload.root, 'sessions', sessionId, admissionNo);
}

export function validateAdmissionNoSafe(admissionNo) {
  return /^[A-Za-z0-9_-]+$/.test(admissionNo);
}

/**
 * Persists an uploaded file to disk under a random name (never the
 * user-supplied original filename) and returns storage metadata to save
 * in the Document row.
 */
export async function saveDocumentFile({ sessionId, admissionNo, documentTypeId, buffer, mimeType }) {
  if (!validateAdmissionNoSafe(admissionNo)) {
    throw new Error('Invalid admission number format');
  }

  const spec = ALLOWED_TYPES[mimeType];
  if (!spec) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const dir = studentDir(sessionId, admissionNo);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });

  const storedFilename = `${documentTypeId}-${crypto.randomUUID()}${spec.ext}`;
  const filePath = path.join(dir, storedFilename);

  await fs.writeFile(filePath, buffer, { mode: 0o640 });

  return { storedFilename, filePath, sizeBytes: buffer.length };
}

export async function readDocumentFile(filePath) {
  // Defense in depth: ensure the resolved path never escapes UPLOAD_ROOT.
  const resolved = path.resolve(filePath);
  const root = path.resolve(env.upload.root);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Refusing to read file outside upload root');
  }
  return fs.readFile(resolved);
}

/** Deletes a file from disk. Used by admin delete/replace actions. Never throws on missing file. */
export async function deleteDocumentFile(filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(env.upload.root);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Refusing to delete file outside upload root');
  }
  await fs.rm(resolved, { force: true });
}

/**
 * Builds the filename served to staff on download, using an admin-defined
 * template (stored in the Setting table) with placeholders like:
 *   {admissionNo} {name} {docType} {year} {session} {batch} {ext}
 * Internal on-disk storage names are NEVER changed by this — this only
 * affects the Content-Disposition filename at download time.
 */
export function buildDisplayFilename(template, fields) {
  const ext = path.extname(fields.originalFilename || '') || '';
  const tokens = {
    year: fields.year ?? '',
    session: fields.session ?? '',
    batch: fields.batch ?? '',
    admissionNo: fields.admissionNo ?? '',
    name: fields.name ?? '',
    docType: fields.docType ?? '',
    ext,
  };

  let name = template.replace(/\{(\w+)\}/g, (_, key) => (key in tokens ? tokens[key] : `{${key}}`));
  if (!name.toLowerCase().endsWith(ext.toLowerCase())) {
    name += ext;
  }
  // Strip anything that isn't safe in a Content-Disposition filename.
  return name.replace(/[^A-Za-z0-9_\-.]/g, '_');
}
