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
 * Resolves the range to actually fetch. If the admin set an explicit
 * sheetRange, use it verbatim. Otherwise, don't guess a tab name (the
 * previous default of 'Students' broke on any sheet not named exactly
 * that) — look up the spreadsheet's actual first tab and read the whole
 * thing.
 */
async function resolveRange(sheets, spreadsheetId, sheetRange) {
  if (sheetRange) return sheetRange;

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  } catch (err) {
    throw new Error(
      `Could not open the spreadsheet (check the Sheet ID is correct and shared with the service account): ${err.message}`
    );
  }

  const firstSheetTitle = meta.data.sheets?.[0]?.properties?.title;
  if (!firstSheetTitle) {
    throw new Error('Could not find any tab in this spreadsheet.');
  }

  return firstSheetTitle;
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
  const range = await resolveRange(sheets, session.sheetId, session.sheetRange);

  let res;
  try {
    res = await sheets.spreadsheets.values.get({ spreadsheetId: session.sheetId, range });
  } catch (err) {
    throw new Error(`Could not read rows from tab "${range}": ${err.message}`);
  }

  const rows = res.data.values || [];
  if (rows.length < 2) {
    return { total: 0, created: 0, skipped: 0, invalid: 0, failures: [] };
  }

  const [headerRow, ...dataRows] = rows;
  const fieldKeys = mapHeadersToFields(headerRow);

  const summary = { total: dataRows.length, created: 0, skipped: 0, invalid: 0 };
  const failures = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2; // +1 for the header row, +1 to make it 1-indexed like a spreadsheet
    const rawSnippet = row.slice(0, 4).join(', ');

    const result = rowArrayToStudent(fieldKeys, row);
    if (!result.ok) {
      summary.invalid += 1;
      failures.push({ row: rowNumber, reason: result.error, raw: rawSnippet });
      continue;
    }

    const student = result.data;

    try {
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
    } catch (err) {
      summary.invalid += 1;
      const reason =
        err.code === 'P2002'
          ? 'A student with this File No. or phone already exists in this session'
          : err.message || 'Could not save this row';
      failures.push({ row: rowNumber, reason, raw: rawSnippet });
    }
  }

  await prisma.session.update({ where: { id: sessionId }, data: { lastImportedAt: new Date() } });

  return { ...summary, failures };
}