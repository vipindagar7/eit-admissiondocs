import { parse } from 'csv-parse/sync';
import { prisma } from '../config/db.js';
import { mapHeadersToFields, rowArrayToStudent } from './studentRowMapper.js';

/**
 * Parses a CSV buffer and upserts students into the given session. The
 * first row is read as headers and matched by name (see
 * studentRowMapper.js) — same header-alias logic as the Sheets import,
 * so both paths accept your real spreadsheet column names.
 */
export async function importStudentsFromCsv(sessionId, csvBuffer) {
  const rows = parse(csvBuffer, { skip_empty_lines: true, trim: true });

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