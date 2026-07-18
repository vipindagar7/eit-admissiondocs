import ExcelJS from 'exceljs';

/**
 * Builds a students export workbook: standard admission-tracking columns
 * plus one column per DocumentType showing Uploaded/Missing for each
 * student — so staff can see submission status for every requirement
 * at a glance, offline, in one file.
 */
export async function buildStudentsWorkbook(students, documentTypes) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');

  const baseColumns = [
    { header: 'SR NO', key: 'srNo', width: 8 },
    { header: 'File No.', key: 'fileNo', width: 14 },
    { header: 'Student Name', key: 'name', width: 22 },
    { header: 'Father Name', key: 'fatherName', width: 22 },
    { header: 'Contact No1', key: 'phone', width: 14 },
    { header: 'Contact No2', key: 'phone2', width: 14 },
    { header: 'Branch', key: 'branch', width: 16 },
    { header: 'Preference 1', key: 'preference1', width: 14 },
    { header: 'Preference 2', key: 'preference2', width: 14 },
    { header: 'Preference 3', key: 'preference3', width: 14 },
    { header: 'State Quota', key: 'stateQuota', width: 12 },
    { header: 'Category', key: 'category', width: 10 },
    { header: 'Religion', key: 'religion', width: 10 },
    { header: 'JEE Rank', key: 'jeeRank', width: 10 },
    { header: 'CUET Rank', key: 'cuetRank', width: 10 },
    { header: 'CET Rank', key: 'cetRank', width: 10 },
    { header: 'IPU Form Filled Status', key: 'ipuFormFilledStatus', width: 16 },
    { header: 'Seat Allotment Status', key: 'seatAllotmentStatus', width: 16 },
    { header: 'Allotment Round', key: 'allotmentRound', width: 14 },
    { header: 'Seat Alloted Course', key: 'seatAllotedCourse', width: 16 },
    { header: 'Admission Status', key: 'admissionStatus', width: 14 },
    { header: 'FEE Status', key: 'feeStatus', width: 12 },
    { header: 'Part Academic Fee', key: 'partAcademicFee', width: 14 },
    { header: 'Portal Status', key: 'status', width: 18 },
    { header: 'Blocked', key: 'blockedText', width: 10 },
  ];

  const docColumns = documentTypes.map((dt) => ({
    header: dt.name,
    key: `doc_${dt.id}`,
    width: 16,
  }));

  sheet.columns = [...baseColumns, ...docColumns];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const s of students) {
    const uploadedTypeIds = new Set(s.documents.map((d) => d.documentTypeId));
    const row = { ...s, blockedText: s.blocked ? 'Blocked' : '' };
    for (const dt of documentTypes) {
      row[`doc_${dt.id}`] = uploadedTypeIds.has(dt.id) ? 'Uploaded' : 'Missing';
    }
    sheet.addRow(row);
  }

  return workbook;
}
