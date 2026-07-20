import { parse } from 'csv-parse/sync';
import { prisma } from '../config/db.js';
import { mapHeadersToFields, rowArrayToStudent } from './studentRowMapper.js';

/**
 * Parses a CSV buffer and upserts students into the given session. The
 * first row is read as headers and matched by name (see
 * studentRowMapper.js). Returns a summary plus a `failures` array — one
 * entry per row that didn't make it in, with the exact reason and a
 * snippet of that row's data — so admin can fix just those rows and
 * re-run the import (already-successful rows are skipped safely).
 */
export async function importStudentsFromCsv(sessionId, csvBuffer) {
  const rows = parse(csvBuffer, { skip_empty_lines: true, trim: true });

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