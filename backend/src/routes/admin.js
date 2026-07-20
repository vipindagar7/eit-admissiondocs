import { Router } from 'express';
import path from 'node:path';
import archiver from 'archiver';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { requireStaffAuth, requireStaffRole } from '../middleware/auth.js';
import { readDocumentFile, deleteDocumentFile, saveDocumentFile, saveTemplateFile, verifyMagicBytes, validateAgainstDocumentType, buildDisplayFilename } from '../lib/storage.js';
import { buildStudentsWorkbook } from '../lib/excelExport.js';
import { importStudentsForSession } from '../lib/sheets.js';
import { importStudentsFromCsv } from '../lib/csvImport.js';
import { requestStaffOtp, verifyStaffOtp } from '../lib/staffOtp.js';
import { getAllSettings, setSetting } from '../lib/settings.js';
import { upload, uploadCsv } from '../middleware/upload.js';

export const adminRouter = Router();

// ============================================================
// AUTH — 2-step: password, then an OTP emailed to the staff member
// ============================================================
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const loginVerifySchema = z.object({ email: z.string().email(), otp: z.string().length(env.otp.length) });

adminRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parsed.data;

  const staff = await prisma.staffUser.findUnique({ where: { email } });
  if (!staff || !staff.active) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  try {
    await requestStaffOtp(email);
  } catch (err) {
    if (err.code === 'RATE_LIMITED') return res.status(429).json({ error: err.message });
    console.error('[admin/login]', err);
    return res.status(500).json({ error: 'Could not send verification code.' });
  }

  // No session cookie yet — step 2 (verify-otp) issues it.
  res.json({ step: 'OTP_REQUIRED', message: 'Verification code sent to your email.' });
});

adminRouter.post('/login/verify-otp', async (req, res) => {
  const parsed = loginVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, otp } = parsed.data;

  const staff = await prisma.staffUser.findUnique({ where: { email } });
  if (!staff || !staff.active) return res.status(401).json({ error: 'Invalid credentials' });

  try {
    await verifyStaffOtp(email, otp);
  } catch (err) {
    const statusMap = { EXPIRED: 401, TOO_MANY_ATTEMPTS: 429, INVALID: 401 };
    return res.status(statusMap[err.code] || 401).json({ error: err.message });
  }

  const token = jwt.sign({ sub: staff.id, role: staff.role }, env.jwt.staffSecret, {
    expiresIn: env.jwt.staffExpiry,
  });

  res.cookie('staff_token', token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ message: 'Logged in', staff: { email: staff.email, role: staff.role } });
});

adminRouter.post('/logout', (req, res) => {
  res.clearCookie('staff_token');
  res.json({ message: 'Logged out' });
});

// --- Who am I (frontend uses this to gate admin-only UI controls) ---
adminRouter.get('/me', requireStaffAuth, async (req, res) => {
  const staff = await prisma.staffUser.findUnique({
    where: { id: req.staff.id },
    select: { id: true, email: true, role: true },
  });
  res.json({ staff });
});

// --- Idle-lock unlock: re-check password only, session token stays valid ---
const unlockSchema = z.object({ password: z.string().min(1) });
adminRouter.post('/unlock', requireStaffAuth, async (req, res) => {
  const parsed = unlockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Password required' });

  const staff = await prisma.staffUser.findUnique({ where: { id: req.staff.id } });
  const valid = staff && (await bcrypt.compare(parsed.data.password, staff.passwordHash));
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });

  res.json({ message: 'Unlocked' });
});

// ============================================================
// SETTINGS — idle-lock minutes, file naming format, service-account email
// ============================================================
adminRouter.get('/settings', requireStaffAuth, async (req, res) => {
  const settings = await getAllSettings();
  res.json({ settings, serviceAccountEmail: env.google.serviceAccountEmail });
});

const settingsSchema = z.object({
  fileNameFormat: z.string().min(1).optional(),
  idleLockMinutes: z.coerce.number().int().min(1).max(120).optional(),
});

adminRouter.put('/settings', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid settings payload' });

  for (const [key, value] of Object.entries(parsed.data)) {
    await setSetting(key, value);
  }

  res.json({ message: 'Settings updated', settings: await getAllSettings() });
});

// ============================================================
// SESSIONS — admin creates a session, pastes a sheet ID, triggers import
// ============================================================
const sessionSchema = z.object({
  name: z.string().min(1),
  year: z.coerce.number().int(),
  batch: z.string().optional(),
  sheetId: z.string().optional(),
  sheetRange: z.string().optional(),
});

adminRouter.post('/sessions', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid session data' });

  const session = await prisma.session.create({ data: parsed.data });
  res.status(201).json({ session });
});

adminRouter.get('/sessions', requireStaffAuth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ sessions });
});

adminRouter.patch('/sessions/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = sessionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid session data' });

  const session = await prisma.session.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ session });
});

adminRouter.post('/sessions/:id/import', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  try {
    const summary = await importStudentsForSession(req.params.id);
    res.json({ message: 'Import complete', summary });
  } catch (err) {
    console.error('[admin/sessions/import]', err);
    res.status(400).json({ error: err.message });
  }
});

// --- Downloadable CSV template for staff bulk import ---
adminRouter.get('/students/csv-template', requireStaffAuth, (req, res) => {
  const headers = [
    'SR NO', 'File No.', 'STUDENT NAME (10th M.Sheet or Form)', 'FATHER NAME (10th M.Sheet or Form)',
    'Contact No1', 'Contact No2', 'PREFERENCE-1', 'PREFERENCE-2', 'PREFERENCE-3', 'State Quota',
    'Category', 'Religion', 'JEE RANK', 'CUET RANK', 'CET RANK', 'IPU Form Filled Status',
    'Seat Allotment Status', 'Allotment Round', 'Seat Alloted course', 'Admission Status',
    'FEE Status', 'Part Academic Fee',
  ];
  const example = [
    '1', 'EIT2026001', 'Vipin Dagar', 'Ram Dagar',
    '9876543210', '9876500000', 'CSE', 'IT', 'ECE', 'Haryana',
    'General', 'Hindu', '45000', 'NA', 'NA', 'Yes',
    'Allotted', 'Round 1', 'CSE', 'Confirmed',
    'Paid', '5000',
  ];

  const csv = [headers.join(','), example.join(',')].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"');
  res.send(csv);
});

// --- CSV bulk import (admin only) ---
adminRouter.post('/sessions/:id/import-csv', requireStaffAuth, requireStaffRole('ADMIN'), uploadCsv.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  try {
    const summary = await importStudentsFromCsv(req.params.id, req.file.buffer);
    res.json({ message: 'CSV import complete', summary });
  } catch (err) {
    console.error('[admin/sessions/import-csv]', err);
    res.status(400).json({ error: err.message || 'Could not parse CSV' });
  }
});

// --- Manual single-student creation (admin only) ---
const createStudentSchema = z.object({
  admissionNo: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(8).max(15),
  email: z.string().email().optional(),
  branch: z.string().optional(),
  srNo: z.coerce.number().int().optional(),
  fileNo: z.string().optional(),
  fatherName: z.string().optional(),
  phone2: z.string().optional(),
  preference1: z.string().optional(),
  preference2: z.string().optional(),
  preference3: z.string().optional(),
  stateQuota: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().optional(),
  jeeRank: z.string().optional(),
  cuetRank: z.string().optional(),
  cetRank: z.string().optional(),
  ipuFormFilledStatus: z.string().optional(),
  seatAllotmentStatus: z.string().optional(),
  allotmentRound: z.string().optional(),
  seatAllotedCourse: z.string().optional(),
  admissionStatus: z.string().optional(),
  feeStatus: z.string().optional(),
  partAcademicFee: z.string().optional(),
});
adminRouter.post('/sessions/:id/students', requireStaffAuth, async (req, res) => {
  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid student data' });

  try {
    const student = await prisma.student.create({
      data: { ...parsed.data, sessionId: req.params.id },
    });
    res.status(201).json({ student });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A student with this admission number or phone already exists in this session' });
    }
    console.error('[admin/sessions/students]', err);
    res.status(500).json({ error: 'Could not create student' });
  }
});

// --- Edit a student's full admission-tracking info (admin only) ---
const studentInfoSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  branch: z.string().optional(),
  srNo: z.coerce.number().int().optional(),
  fileNo: z.string().optional(),
  fatherName: z.string().optional(),
  phone: z.string().min(8).max(15).optional(),
  phone2: z.string().optional(),
  preference1: z.string().optional(),
  preference2: z.string().optional(),
  preference3: z.string().optional(),
  stateQuota: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().optional(),
  jeeRank: z.string().optional(),
  cuetRank: z.string().optional(),
  cetRank: z.string().optional(),
  ipuFormFilledStatus: z.string().optional(),
  seatAllotmentStatus: z.string().optional(),
  allotmentRound: z.string().optional(),
  seatAllotedCourse: z.string().optional(),
  admissionStatus: z.string().optional(),
  feeStatus: z.string().optional(),
  partAcademicFee: z.string().optional(),
});
adminRouter.patch('/students/:id/info', requireStaffAuth, async (req, res) => {
  const parsed = studentInfoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  try {
    const student = await prisma.student.update({ where: { id: req.params.id }, data: parsed.data });
    res.json({ student });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Another student in this session already has that Contact No1 (or File No.)' });
    }
    console.error('[admin/students/info]', err);
    res.status(500).json({ error: 'Could not update student' });
  }
});

// ============================================================
// DOCUMENT TYPES — the "form": admin defines what students must submit,
// each with its own required flag, allowed file types, and max size.
// ============================================================
const documentTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  required: z.boolean().default(true),
  allowedMimeTypes: z
    .array(z.enum(['application/pdf', 'image/jpeg', 'image/png']))
    .min(1)
    .default(['application/pdf', 'image/jpeg', 'image/png']),
  maxSizeKB: z.number().int().min(1).max(20480).default(5120),
});

adminRouter.get('/document-types', requireStaffAuth, async (req, res) => {
  const documentTypes = await prisma.documentType.findMany({ orderBy: { order: 'asc' } });
  res.json({ documentTypes });
});

adminRouter.post('/document-types', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = documentTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid document type', detail: parsed.error.flatten() });

  const last = await prisma.documentType.findFirst({ orderBy: { order: 'desc' } });
  const nextOrder = (last?.order ?? -1) + 1;

  const documentType = await prisma.documentType.create({
    data: { ...parsed.data, allowedMimeTypes: parsed.data.allowedMimeTypes.join(','), order: nextOrder },
  });
  res.status(201).json({ documentType });
});

// --- Reorder (drag-and-drop) — body: { orderedIds: string[] } in the
// desired display order. Must be registered before /document-types/:id
// so "reorder" doesn't get captured as an :id. ---
adminRouter.patch('/document-types/reorder', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ orderedIds: z.array(z.string()).min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.documentType.update({ where: { id }, data: { order: index } })
    )
  );

  res.json({ message: 'Order updated' });
});

adminRouter.patch('/document-types/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = documentTypeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid document type' });

  const data = { ...parsed.data };
  if (data.allowedMimeTypes) data.allowedMimeTypes = data.allowedMimeTypes.join(',');

  const documentType = await prisma.documentType.update({ where: { id: req.params.id }, data });
  res.json({ documentType });
});

// --- Delete a document type (admin only). Blocked if any student has
// already uploaded a document of this type — delete those documents
// first (via the student detail page) rather than silently orphaning
// files on disk. ---
adminRouter.delete('/document-types/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const inUseCount = await prisma.document.count({ where: { documentTypeId: req.params.id } });
  if (inUseCount > 0) {
    return res.status(400).json({
      error: `Cannot delete — ${inUseCount} student document${inUseCount === 1 ? '' : 's'} already use this type. Delete those uploads first.`,
    });
  }

  await prisma.documentType.delete({ where: { id: req.params.id } });
  res.json({ message: 'Document type deleted' });
});

// --- Upload/replace a downloadable template for a document type (admin
// only) — e.g. a blank undertaking form students download, fill, and
// upload back as their submission. ---
adminRouter.post('/document-types/:id/template', requireStaffAuth, requireStaffRole('ADMIN'), upload.single('file'), async (req, res) => {
  const docType = await prisma.documentType.findUnique({ where: { id: req.params.id } });
  if (!docType) return res.status(404).json({ error: 'Not found' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    return res.status(400).json({ error: 'File content does not match its declared type' });
  }

  const oldTemplatePath = docType.templateFilePath;
  const { filePath } = await saveTemplateFile({ documentTypeId: docType.id, buffer: file.buffer, mimeType: file.mimetype });

  await prisma.documentType.update({
    where: { id: docType.id },
    data: { templateFilePath: filePath, templateOriginalName: file.originalname, templateMimeType: file.mimetype },
  });

  if (oldTemplatePath) await deleteDocumentFile(oldTemplatePath);

  res.json({ message: 'Template uploaded' });
});

// --- Download a document type's template (any staff, for reference) ---
adminRouter.get('/document-types/:id/template', requireStaffAuth, async (req, res) => {
  const docType = await prisma.documentType.findUnique({ where: { id: req.params.id } });
  if (!docType?.templateFilePath) return res.status(404).json({ error: 'No template uploaded for this document' });

  try {
    const buffer = await readDocumentFile(docType.templateFilePath);
    res.setHeader('Content-Type', docType.templateMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${docType.templateOriginalName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[admin/document-types/template]', err);
    res.status(500).json({ error: 'Could not read template file' });
  }
});

// ============================================================
// FORM QUESTIONS — admin-defined text questions, separate from file
// uploads (e.g. "Category", "Aadhar number", "Any medical condition?")
// ============================================================
const formQuestionSchema = z.object({
  label: z.string().min(1),
  description: z.string().max(500).optional(),
  required: z.boolean().default(true),
});

adminRouter.get('/form-questions', requireStaffAuth, async (req, res) => {
  const formQuestions = await prisma.formQuestion.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ formQuestions });
});

adminRouter.post('/form-questions', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = formQuestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid question' });

  const formQuestion = await prisma.formQuestion.create({ data: parsed.data });
  res.status(201).json({ formQuestion });
});

adminRouter.patch('/form-questions/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = formQuestionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid question' });

  const formQuestion = await prisma.formQuestion.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ formQuestion });
});

adminRouter.delete('/form-questions/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  await prisma.formQuestion.delete({ where: { id: req.params.id } });
  res.json({ message: 'Question deleted' });
});

// ============================================================
// NOTICE BOARD — admin-posted announcements shown to students
// ============================================================
const noticeSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  active: z.boolean().default(true),
});

adminRouter.get('/notices', requireStaffAuth, async (req, res) => {
  const notices = await prisma.notice.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ notices });
});

adminRouter.post('/notices', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = noticeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid notice' });

  const notice = await prisma.notice.create({ data: parsed.data });
  res.status(201).json({ notice });
});

adminRouter.patch('/notices/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = noticeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid notice' });

  const notice = await prisma.notice.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ notice });
});

adminRouter.delete('/notices/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  await prisma.notice.delete({ where: { id: req.params.id } });
  res.json({ message: 'Notice deleted' });
});

// ============================================================
// ACCESS REQUESTS — students whose number wasn't found at login,
// asking to be added
// ============================================================
adminRouter.get('/access-requests', requireStaffAuth, async (req, res) => {
  const requests = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ requests });
});

adminRouter.patch('/access-requests/:id', requireStaffAuth, async (req, res) => {
  const parsed = z.object({ resolved: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const request = await prisma.accessRequest.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ request });
});

adminRouter.delete('/access-requests/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  await prisma.accessRequest.delete({ where: { id: req.params.id } });
  res.json({ message: 'Request deleted' });
});

// ============================================================
// UPLOAD ISSUES — every failed student upload attempt, across all
// students, so admin can see who's stuck without hunting through each
// student's page one by one.
// ============================================================
adminRouter.get('/upload-issues', requireStaffAuth, async (req, res) => {
  const [logs, documentTypes] = await Promise.all([
    prisma.uploadAttemptLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        student: { select: { id: true, name: true, fileNo: true, admissionNo: true, phone: true } },
      },
    }),
    prisma.documentType.findMany({ select: { id: true, name: true } }),
  ]);

  // documentTypeId on the log is a plain column (no hard FK — see schema
  // comment), so resolve the name separately rather than via `include`.
  const docTypeNameById = new Map(documentTypes.map((dt) => [dt.id, dt.name]));

  const result = logs.map((log) => ({
    ...log,
    documentTypeName: docTypeNameById.get(log.documentTypeId) || 'Unknown document',
  }));

  res.json({ logs: result });
});

// ============================================================
// STUDENTS — list/search, detail, block/unblock (individual + bulk), status
// ============================================================
adminRouter.get('/students', requireStaffAuth, async (req, res) => {
  const { status, search, sessionId, blocked } = req.query;

  const students = await prisma.student.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(blocked !== undefined ? { blocked: blocked === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { admissionNo: { contains: String(search), mode: 'insensitive' } },
              { phone: { contains: String(search) } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { documents: true } }, session: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ students });
});

// --- Export the student list + per-document status to Excel ---
adminRouter.get('/students/export', requireStaffAuth, async (req, res) => {
  const { status, sessionId, blocked } = req.query;

  const [students, documentTypes, formQuestions] = await Promise.all([
    prisma.student.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(blocked !== undefined ? { blocked: blocked === 'true' } : {}),
      },
      include: { documents: true, answers: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.documentType.findMany({ orderBy: { order: 'asc' } }),
    prisma.formQuestion.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  try {
    const workbook = await buildStudentsWorkbook(students, documentTypes, formQuestions);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students_export.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[admin/students/export]', err);
    res.status(500).json({ error: 'Could not generate export' });
  }
});

// --- Bulk download ALL uploaded documents as a single ZIP (admin only —
// this is raw student PII in bulk, kept more restricted than the Excel
// export). One folder per student named "name@fileNo", each file inside
// named "documentTypeName@fileNo.ext". Streamed directly to the response
// so large document sets don't get buffered fully in memory. ---
function safeZipName(value) {
  return String(value || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'unknown';
}

adminRouter.get('/documents/export-zip', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const { status, sessionId, blocked } = req.query;

  const students = await prisma.student.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(blocked !== undefined ? { blocked: blocked === 'true' } : {}),
    },
    include: { documents: { include: { documentType: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="student_documents.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('[admin/documents/export-zip]', err);
    if (!res.headersSent) res.status(500);
    res.end();
  });
  archive.pipe(res);

  const uploadRoot = path.resolve(env.upload.root);

  for (const student of students) {
    if (student.documents.length === 0) continue;

    const fileNoOrAdmission = student.fileNo || student.admissionNo;
    const folderName = `${safeZipName(student.name)}@${safeZipName(fileNoOrAdmission)}`;

    for (const doc of student.documents) {
      const resolvedPath = path.resolve(doc.filePath);
      // Defense in depth: never add a file that somehow resolves outside
      // the upload root, same guard used everywhere else files are read.
      if (!resolvedPath.startsWith(uploadRoot + path.sep)) continue;

      const ext = path.extname(doc.originalFilename) || '';
      const entryName = `${safeZipName(doc.documentType.name)}@${safeZipName(fileNoOrAdmission)}${ext}`;
      archive.file(resolvedPath, { name: `${folderName}/${entryName}` });
    }
  }

  await archive.finalize();
});

adminRouter.get('/students/:id', requireStaffAuth, async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      documents: { include: { documentType: true } },
      answers: { include: { question: true } },
      statusLogs: { orderBy: { changedAt: 'desc' } },
      uploadAttemptLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      session: true,
    },
  });
  if (!student) return res.status(404).json({ error: 'Not found' });
  res.json({ student });
});

// --- Delete a student entirely (admin only) — cleans up their physical
// files first, then the DB row cascades to remove documents, answers,
// and status logs automatically. ---
adminRouter.delete('/students/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { documents: true },
  });
  if (!student) return res.status(404).json({ error: 'Not found' });

  for (const doc of student.documents) {
    await deleteDocumentFile(doc.filePath);
  }

  await prisma.student.delete({ where: { id: student.id } });
  res.json({ message: 'Student deleted' });
});

// --- Block / unblock: individual (admin only) ---
const blockSchema = z.object({ blocked: z.boolean(), reason: z.string().optional() });
adminRouter.patch('/students/:id/block', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: {
      blocked: parsed.data.blocked,
      blockedAt: parsed.data.blocked ? new Date() : null,
      blockedReason: parsed.data.blocked ? (parsed.data.reason ?? null) : null,
    },
  });

  res.json({ student });
});

// --- Block / unblock: bulk (admin only) ---
const bulkBlockSchema = z.object({
  studentIds: z.array(z.string()).min(1),
  blocked: z.boolean(),
  reason: z.string().optional(),
});
adminRouter.post('/students/bulk-block', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = bulkBlockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { studentIds, blocked, reason } = parsed.data;

  const result = await prisma.student.updateMany({
    where: { id: { in: studentIds } },
    data: {
      blocked,
      blockedAt: blocked ? new Date() : null,
      blockedReason: blocked ? (reason ?? null) : null,
    },
  });

  res.json({ message: 'Bulk block updated', count: result.count });
});

// --- Status: individual ---
const statusSchema = z.object({
  status: z.enum(['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED', 'VERIFIED', 'ADMITTED']),
  note: z.string().optional(),
});
adminRouter.patch('/students/:id/status', requireStaffAuth, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });

  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) return res.status(404).json({ error: 'Not found' });

  const { status, note } = parsed.data;

  const [updated] = await prisma.$transaction([
    prisma.student.update({ where: { id: student.id }, data: { status } }),
    prisma.statusLog.create({
      data: { studentId: student.id, staffId: req.staff.id, oldStatus: student.status, newStatus: status, note },
    }),
  ]);

  res.json({ message: 'Status updated', student: updated });
});

// --- Status: bulk ---
const bulkStatusSchema = z.object({
  studentIds: z.array(z.string()).min(1),
  status: z.enum(['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED', 'VERIFIED', 'ADMITTED']),
  note: z.string().optional(),
});
adminRouter.post('/students/bulk-status', requireStaffAuth, async (req, res) => {
  const parsed = bulkStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { studentIds, status, note } = parsed.data;

  const students = await prisma.student.findMany({ where: { id: { in: studentIds } } });

  await prisma.$transaction([
    prisma.student.updateMany({ where: { id: { in: studentIds } }, data: { status } }),
    prisma.statusLog.createMany({
      data: students.map((s) => ({
        studentId: s.id,
        staffId: req.staff.id,
        oldStatus: s.status,
        newStatus: status,
        note,
      })),
    }),
  ]);

  res.json({ message: 'Bulk status updated', count: students.length });
});

// --- Preview a document inline for staff (both roles) — not a forced
// download, used for the preview modal ---
adminRouter.get('/documents/:id/preview', requireStaffAuth, async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: 'Not found' });

  try {
    const buffer = await readDocumentFile(document.filePath);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[admin/preview]', err);
    res.status(500).json({ error: 'Could not read file' });
  }
});

// ============================================================
// DOCUMENTS — download (logged), delete, replace
// ============================================================
adminRouter.get('/documents/:id/download', requireStaffAuth, async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { documentType: true, student: { include: { session: true } } },
  });
  if (!document) return res.status(404).json({ error: 'Not found' });

  try {
    const buffer = await readDocumentFile(document.filePath);

    await prisma.downloadLog.create({ data: { staffId: req.staff.id, documentId: document.id } });

    const settings = await getAllSettings();
    const displayName = buildDisplayFilename(settings.fileNameFormat, {
      year: document.student.session.year,
      session: document.student.session.name,
      batch: document.student.session.batch,
      admissionNo: document.student.admissionNo,
      name: document.student.name,
      docType: document.documentType.name,
      originalFilename: document.originalFilename,
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${displayName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[admin/download]', err);
    res.status(500).json({ error: 'Could not read file' });
  }
});

// --- Upload a document on a student's behalf (admin only) — for a
// document type they haven't submitted yet ("missing"). Also works as
// an upsert if one already exists, mirroring /replace's behavior. ---
adminRouter.post('/students/:studentId/documents/:documentTypeId', requireStaffAuth, requireStaffRole('ADMIN'), upload.single('file'), async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.studentId } });
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const docType = await prisma.documentType.findUnique({ where: { id: req.params.documentTypeId } });
  if (!docType) return res.status(404).json({ error: 'Unknown document type' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    return res.status(400).json({ error: 'File content does not match its declared type' });
  }

  const check = validateAgainstDocumentType(docType, { mimeType: file.mimetype, sizeBytes: file.size });
  if (!check.ok) return res.status(400).json({ error: check.error });

  const existingDocument = await prisma.document.findUnique({
    where: { studentId_documentTypeId: { studentId: student.id, documentTypeId: docType.id } },
  });

  const { storedFilename, filePath, sizeBytes } = await saveDocumentFile({
    sessionId: student.sessionId,
    admissionNo: student.admissionNo,
    documentTypeId: docType.id,
    buffer: file.buffer,
    mimeType: file.mimetype,
  });

  const document = await prisma.document.upsert({
    where: { studentId_documentTypeId: { studentId: student.id, documentTypeId: docType.id } },
    update: {
      originalFilename: file.originalname,
      storedFilename,
      filePath,
      mimeType: file.mimetype,
      sizeBytes,
      uploadedAt: new Date(),
    },
    create: {
      studentId: student.id,
      documentTypeId: docType.id,
      originalFilename: file.originalname,
      storedFilename,
      filePath,
      mimeType: file.mimetype,
      sizeBytes,
    },
  });

  if (existingDocument && existingDocument.filePath !== filePath) {
    await deleteDocumentFile(existingDocument.filePath);
  }

  res.status(201).json({ message: 'Document uploaded', documentId: document.id });
});

// --- Delete a student's uploaded document ---
adminRouter.delete('/documents/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: 'Not found' });

  await deleteDocumentFile(document.filePath);

  await prisma.$transaction([
    prisma.adminFileLog.create({
      data: {
        staffId: req.staff.id,
        documentId: document.id,
        action: 'DELETE',
        detail: document.originalFilename,
      },
    }),
    prisma.document.delete({ where: { id: document.id } }),
  ]);

  res.json({ message: 'Document deleted' });
});

// --- Replace a student's uploaded document with a new file ---
adminRouter.post('/documents/:id/replace', requireStaffAuth, requireStaffRole('ADMIN'), upload.single('file'), async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { student: true },
  });
  if (!document) return res.status(404).json({ error: 'Not found' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    return res.status(400).json({ error: 'File content does not match its declared type' });
  }

  const docType = await prisma.documentType.findUnique({ where: { id: document.documentTypeId } });
  const check = validateAgainstDocumentType(docType, { mimeType: file.mimetype, sizeBytes: file.size });
  if (!check.ok) return res.status(400).json({ error: check.error });

  const oldFilePath = document.filePath;
  const oldOriginalName = document.originalFilename;

  const { storedFilename, filePath, sizeBytes } = await saveDocumentFile({
    sessionId: document.student.sessionId,
    admissionNo: document.student.admissionNo,
    documentTypeId: document.documentTypeId,
    buffer: file.buffer,
    mimeType: file.mimetype,
  });

  await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: {
        originalFilename: file.originalname,
        storedFilename,
        filePath,
        mimeType: file.mimetype,
        sizeBytes,
        uploadedAt: new Date(),
      },
    }),
    prisma.adminFileLog.create({
      data: { staffId: req.staff.id, documentId: document.id, action: 'REPLACE', detail: `was: ${oldOriginalName}` },
    }),
  ]);

  await deleteDocumentFile(oldFilePath);

  res.json({ message: 'Document replaced' });
});

// ============================================================
// STAFF MANAGEMENT — admin creates other staff accounts
// ============================================================
const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'VERIFIER']).default('VERIFIER'),
});

adminRouter.get('/staff', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const staff = await prisma.staffUser.findMany({
    select: { id: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ staff });
});

adminRouter.post('/staff', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password, role } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 12);
  const staff = await prisma.staffUser.create({ data: { email, passwordHash, role } });

  res.status(201).json({ staff: { id: staff.id, email: staff.email, role: staff.role } });
});

adminRouter.patch('/staff/:id', requireStaffAuth, requireStaffRole('ADMIN'), async (req, res) => {
  const parsed = z
    .object({
      active: z.boolean().optional(),
      role: z.enum(['ADMIN', 'VERIFIER']).optional(),
      email: z.string().email().optional(),
      password: z.string().min(8).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { password, ...rest } = parsed.data;
  const data = { ...rest };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    const staff = await prisma.staffUser.update({ where: { id: req.params.id }, data });
    res.json({ staff: { id: staff.id, email: staff.email, role: staff.role, active: staff.active } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That email is already in use by another staff account' });
    }
    console.error('[admin/staff/patch]', err);
    res.status(500).json({ error: 'Could not update staff account' });
  }
});