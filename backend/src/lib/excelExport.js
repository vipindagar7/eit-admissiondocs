import ExcelJS from 'exceljs';

/**
 * Builds the students export workbook — exactly: SR NO, File No., Student
 * Name, Father Name, Contact No1, Contact No2, Branch, Preference 1, then
 * one column per form question (their answer), then one column per
 * document type (Uploaded/Missing). No other admission-tracking fields.
 */
export async function buildStudentsWorkbook(students, documentTypes, formQuestions) {
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
  ];

  const questionColumns = formQuestions.map((q) => ({
    header: q.label,
    key: `q_${q.id}`,
    width: 20,
  }));

  const docColumns = documentTypes.map((dt) => ({
    header: dt.name,
    key: `doc_${dt.id}`,
    width: 16,
  }));

  sheet.columns = [...baseColumns, ...questionColumns, ...docColumns];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const s of students) {
    const uploadedTypeIds = new Set(s.documents.map((d) => d.documentTypeId));
    const answerByQuestion = new Map(s.answers.map((a) => [a.questionId, a.answerText]));

    const row = {
      srNo: s.srNo,
      fileNo: s.fileNo,
      name: s.name,
      fatherName: s.fatherName,
      phone: s.phone,
      phone2: s.phone2,
      branch: s.branch,
      preference1: s.preference1,
    };

    for (const q of formQuestions) {
      row[`q_${q.id}`] = answerByQuestion.get(q.id) || '';
    }
    for (const dt of documentTypes) {
      row[`doc_${dt.id}`] = uploadedTypeIds.has(dt.id) ? 'Uploaded' : 'Missing';
    }

    sheet.addRow(row);
  }

  return workbook;
}