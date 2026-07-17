import { google } from 'googleapis';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { mapHeadersToFields, rowArrayToStudent } from './studentRowMapper.js';

function getSheetsClient() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

  // Preferred: read the downloaded service-account JSON key file directly.
  // This sidesteps every .env-escaping pitfall that causes cryptic OpenSSL
  // "DECODER routines::unsupported" errors with a manually pasted key.
  if (env.google.keyFile) {
    const auth = new google.auth.GoogleAuth({ keyFile: env.google.keyFile, scopes });
    return google.sheets({ version: 'v4', auth });
  }

  // Fallback: raw email + private key pasted into .env.
  const auth = new google.auth.JWT({
    email: env.google.serviceAccountEmail,
    key: env.google.privateKey,
    scopes,
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Pulls the sheet configured on a specific Session and upserts students
 * scoped to that session only. The first row of the sheet is read as
 * headers and matched against known column names (see
 * studentRowMapper.js) — no fixed column positions required, so your
 * actual spreadsheet layout just works.
 *
 * "Skip if exists" is evaluated within the session (sessionId +
 * admissionNo/phone) — the same phone number can exist in a different
 * session without conflict.
 */
export async function importStudentsForSession(sessionId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (!session.sheetId) throw new Error('This session has no sheet ID configured yet');

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: session.sheetId,
    // Default: the whole "Students" sheet/tab, headers in row 1.
    // Admin can override with a specific range in session.sheetRange if needed.
    range: session.sheetRange || 'Students',
  });

  const rows = res.data.values || [];
  if (rows.length < 2) {
    return { total: 0, created: 0, skipped: 0, invalid: 0 };
  }

  const [headerRow, ...dataRows] = rows;
  const fieldKeys = mapHeadersToFields(headerRow);

  const summary = { total: dataRows.length, created: 0, skipped: 0, invalid: 0 };

  for (const row of dataRows) {
    const student = rowArrayToStudent(fieldKeys, row);
    if (!student) {
      summary.invalid += 1;
      continue;
    }

    const existing = await prisma.student.findFirst({
      where: {
        sessionId,
        OR: [{ admissionNo: student.admissionNo }, { phone: student.phone }],
      },
    });

    if (existing) {
      summary.skipped += 1;
      continue;
    }

    await prisma.student.create({ data: { ...student, sessionId } });
    summary.created += 1;
  }

  await prisma.session.update({ where: { id: sessionId }, data: { lastImportedAt: new Date() } });

  return summary;
}
