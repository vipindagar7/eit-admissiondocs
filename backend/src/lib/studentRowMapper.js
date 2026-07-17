// Maps a normalized spreadsheet/CSV header to our Student field name.
// Normalization strips parenthetical notes, punctuation, and collapses
// whitespace/case, so headers like "STUDENT NAME (10th M.Sheet or Form)"
// and "File No." match reliably without needing exact-string headers.
const HEADER_ALIASES = {
  'sr no': 'srNo',
  'file no': 'fileNo', // also used as the unique admission number — see rowArrayToStudent()
  'admission no': 'admissionNo',
  'admission number': 'admissionNo',
  'student name': 'name',
  'name': 'name',
  'father name': 'fatherName',
  'contact no1': 'phone',
  'contact no 1': 'phone',
  'phone': 'phone',
  'contact no2': 'phone2',
  'contact no 2': 'phone2',
  'email': 'email',
  'dob': 'dob',
  'branch': 'branch',
  'preference 1': 'preference1',
  'preference 2': 'preference2',
  'preference 3': 'preference3',
  'state quota': 'stateQuota',
  'category': 'category',
  'religion': 'religion',
  'jee rank': 'jeeRank',
  'cuet rank': 'cuetRank',
  'cet rank': 'cetRank',
  'ipu form filled status': 'ipuFormFilledStatus',
  'seat allotment status': 'seatAllotmentStatus',
  'allotment round': 'allotmentRound',
  'seat alloted course': 'seatAllotedCourse',
  'admission status': 'admissionStatus',
  'fee status': 'feeStatus',
  'part academic fee': 'partAcademicFee',
};

function normalizeHeader(h) {
  return String(h)
    .replace(/\(.*?\)/g, '') // drop parenthetical notes, e.g. "(10th M.Sheet or Form)"
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ') // strip punctuation like '.' '/'
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Maps a header row (array of strings) to an array of field keys (or null for unrecognized columns), same index order. */
export function mapHeadersToFields(headers) {
  return headers.map((h) => HEADER_ALIASES[normalizeHeader(h)] || null);
}

/**
 * Builds a Student data object from one data row, given the field-key
 * array produced by mapHeadersToFields(). Returns null if the row is
 * missing a usable admission number, name, or phone (the minimum we
 * need to create a Student).
 */
export function rowArrayToStudent(fieldKeys, rowValues) {
  const data = {};

  fieldKeys.forEach((key, i) => {
    if (!key) return;
    const raw = rowValues[i];
    if (raw === undefined || raw === null || String(raw).trim() === '') return;

    if (key === 'srNo') {
      const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(n)) data.srNo = n;
    } else if (key === 'dob') {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) data.dob = d;
    } else {
      data[key] = String(raw).trim();
    }
  });

  // File No. doubles as the unique admission number when no explicit
  // "Admission No" column is present.
  if (!data.admissionNo && data.fileNo) data.admissionNo = data.fileNo;

  if (!data.admissionNo || !data.name || !data.phone) return null;

  return data;
}