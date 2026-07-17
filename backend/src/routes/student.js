import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { requestOtp, verifyOtp } from '../lib/otp.js';
import { requireStudentAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { verifyMagicBytes, saveDocumentFile, validateAgainstDocumentType, deleteDocumentFile, readDocumentFile } from '../lib/storage.js';
import { isFullySubmitted } from '../lib/submissionCheck.js';

export const studentRouter = Router();

const phoneSchema = z.object({ phone: z.string().min(8).max(15) });
const otpVerifySchema = z.object({ phone: z.string().min(8).max(15), otp: z.string().length(env.otp.length) });

// --- OTP request -----------------------------------------------------------
studentRouter.post('/request-otp', async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid phone number' });
  const { phone } = parsed.data;

  // A phone may exist in multiple sessions (different admission years) —
  // OTP itself is phone-scoped, session selection happens after verify.
  const student = await prisma.student.findFirst({ where: { phone } });
  if (!student) {
    // Deliberately vague — don't reveal whether a phone is registered.
    return res.status(200).json({ message: 'If this number is registered, an OTP has been sent.' });
  }

  if (student.blocked) {
    return res.status(403).json({ error: 'Your access has been blocked. Contact the admissions office.' });
  }

  try {
    await requestOtp(phone);
    return res.status(200).json({ message: 'OTP sent.' });
  } catch (err) {
    if (err.code === 'RATE_LIMITED') {
      return res.status(429).json({ error: err.message });
    }
    console.error('[student/request-otp]', err);
    return res.status(500).json({ error: 'Could not send OTP right now.' });
  }
});

// --- OTP verify -> issue session cookie ------------------------------------
studentRouter.post('/verify-otp', async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { phone, otp } = parsed.data;

  // If the same phone exists in more than one session, prefer the most
  // recently created (latest admission cycle) one.
  const student = await prisma.student.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } });
  if (!student) return res.status(401).json({ error: 'Invalid OTP' });

  try {
    await verifyOtp(phone, otp);
  } catch (err) {
    const statusMap = { EXPIRED: 401, TOO_MANY_ATTEMPTS: 429, INVALID: 401 };
    return res.status(statusMap[err.code] || 401).json({ error: err.message });
  }

  if (student.blocked) {
    return res.status(403).json({ error: 'Your access has been blocked. Contact the admissions office.' });
  }

  const token = jwt.sign(
    { sub: student.id, admissionNo: student.admissionNo, sessionId: student.sessionId },
    env.jwt.studentSecret,
    { expiresIn: env.jwt.studentExpiry }
  );

  res.cookie('student_token', token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000,
  });

  return res.status(200).json({
    message: 'Logged in',
    student: { name: student.name, admissionNo: student.admissionNo },
  });
});

studentRouter.post('/logout', (req, res) => {
  res.clearCookie('student_token');
  res.status(200).json({ message: 'Logged out' });
});

// --- Document listing (required types + this student's upload status) -----
studentRouter.get('/documents', requireStudentAuth, async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.id } });
  if (!student || student.blocked) return res.status(403).json({ error: 'Access blocked' });

  const [docTypes, uploaded] = await Promise.all([
    prisma.documentType.findMany({ orderBy: { name: 'asc' } }),
    prisma.document.findMany({ where: { studentId: req.student.id } }),
  ]);

  const uploadedByType = new Map(uploaded.map((d) => [d.documentTypeId, d]));

  const result = docTypes.map((dt) => ({
    documentTypeId: dt.id,
    name: dt.name,
    description: dt.description,
    required: dt.required,
    uploaded: uploadedByType.has(dt.id),
    uploadedAt: uploadedByType.get(dt.id)?.uploadedAt ?? null,
    mimeType: uploadedByType.get(dt.id)?.mimeType ?? null,
  }));

  res.json({ documents: result, status: student.status });
});

// --- Upload a document ------------------------------------------------------
studentRouter.post('/documents/:documentTypeId/upload', requireStudentAuth, upload.single('file'), async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.id } });
  if (!student || student.blocked) return res.status(403).json({ error: 'Access blocked' });

  const { documentTypeId } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const docType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!docType) return res.status(404).json({ error: 'Unknown document type' });

  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    return res.status(400).json({ error: 'File content does not match its declared type' });
  }

  const check = validateAgainstDocumentType(docType, { mimeType: file.mimetype, sizeBytes: file.size });
  if (!check.ok) return res.status(400).json({ error: check.error });

  // Capture the existing document (if any) BEFORE we overwrite it, so we
  // can delete the old physical file after the new one is safely saved —
  // otherwise re-uploads silently orphan the previous file on disk forever.
  const existingDocument = await prisma.document.findUnique({
    where: { studentId_documentTypeId: { studentId: req.student.id, documentTypeId } },
  });

  const { storedFilename, filePath, sizeBytes } = await saveDocumentFile({
    sessionId: req.student.sessionId,
    admissionNo: req.student.admissionNo,
    documentTypeId,
    buffer: file.buffer,
    mimeType: file.mimetype,
  });

  const document = await prisma.document.upsert({
    where: { studentId_documentTypeId: { studentId: req.student.id, documentTypeId } },
    update: {
      originalFilename: file.originalname,
      storedFilename,
      filePath,
      mimeType: file.mimetype,
      sizeBytes,
      uploadedAt: new Date(),
    },
    create: {
      studentId: req.student.id,
      documentTypeId,
      originalFilename: file.originalname,
      storedFilename,
      filePath,
      mimeType: file.mimetype,
      sizeBytes,
    },
  });

  // New file is safely on disk and the DB row is updated — now it's safe
  // to remove the old physical file.
  if (existingDocument && existingDocument.filePath !== filePath) {
    await deleteDocumentFile(existingDocument.filePath);
  }

  if (student.status === 'PENDING' && (await isFullySubmitted(student.id))) {
    await prisma.student.update({ where: { id: student.id }, data: { status: 'SUBMITTED' } });
  }

  res.status(201).json({ message: 'Uploaded', documentId: document.id });
});

// --- Preview a student's own uploaded document inline (not a forced
// download) — used for the image/PDF preview modal on the dashboard ---
studentRouter.get('/documents/:documentTypeId/preview', requireStudentAuth, async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.id } });
  if (!student || student.blocked) return res.status(403).json({ error: 'Access blocked' });

  const document = await prisma.document.findUnique({
    where: { studentId_documentTypeId: { studentId: req.student.id, documentTypeId: req.params.documentTypeId } },
  });
  if (!document) return res.status(404).json({ error: 'Not found' });

  try {
    const buffer = await readDocumentFile(document.filePath);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[student/preview]', err);
    res.status(500).json({ error: 'Could not read file' });
  }
});

// --- Profile (read-only summary of who they are + their status) ---
studentRouter.get('/profile', requireStudentAuth, async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.id } });
  if (!student || student.blocked) return res.status(403).json({ error: 'Access blocked' });

  res.json({
    student: {
      // Mandatory display fields — shown read-only, sourced from the
      // admissions sheet/import, not editable by the student.
      srNo: student.srNo,
      fileNo: student.fileNo,
      name: student.name,
      fatherName: student.fatherName,
      phone: student.phone,
      phone2: student.phone2,
      seatAllotedCourse: student.seatAllotedCourse,

      admissionNo: student.admissionNo, // internal unique key — File No. is what's shown
      email: student.email,
      branch: student.branch,
      status: student.status,

      // Student's own course choices — separate from seatAllotedCourse above
      preference1: student.preference1,
      preference2: student.preference2,
      preference3: student.preference3,
    },
  });
});

// --- Course preferences (student-filled) ---
const preferencesSchema = z.object({
  preference1: z.string().max(200).optional(),
  preference2: z.string().max(200).optional(),
  preference3: z.string().max(200).optional(),
});
studentRouter.patch('/preferences', requireStudentAuth, async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.id } });
  if (!student || student.blocked) return res.status(403).json({ error: 'Access blocked' });

  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid preferences' });

  await prisma.student.update({ where: { id: student.id }, data: parsed.data });
  res.json({ message: 'Preferences saved' });
});

// --- Text questions (admin-defined, separate from file uploads) -----------
studentRouter.get('/questions', requireStudentAuth, async (req, res) => {
  const [questions, answers] = await Promise.all([
    prisma.formQuestion.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.studentAnswer.findMany({ where: { studentId: req.student.id } }),
  ]);

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  const result = questions.map((q) => ({
    questionId: q.id,
    label: q.label,
    description: q.description,
    required: q.required,
    answerText: answerByQuestion.get(q.id)?.answerText ?? '',
  }));

  res.json({ questions: result });
});

const answerSchema = z.object({ answerText: z.string().max(2000) });
studentRouter.post('/questions/:questionId/answer', requireStudentAuth, async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.id } });
  if (!student || student.blocked) return res.status(403).json({ error: 'Access blocked' });

  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid answer' });

  const { questionId } = req.params;
  const question = await prisma.formQuestion.findUnique({ where: { id: questionId } });
  if (!question) return res.status(404).json({ error: 'Unknown question' });

  await prisma.studentAnswer.upsert({
    where: { studentId_questionId: { studentId: req.student.id, questionId } },
    update: { answerText: parsed.data.answerText, answeredAt: new Date() },
    create: { studentId: req.student.id, questionId, answerText: parsed.data.answerText },
  });

  if (student.status === 'PENDING' && (await isFullySubmitted(student.id))) {
    await prisma.student.update({ where: { id: student.id }, data: { status: 'SUBMITTED' } });
  }

  res.json({ message: 'Answer saved' });
});
