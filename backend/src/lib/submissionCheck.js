import { prisma } from '../config/db.js';

/**
 * A student is "fully submitted" when every required DocumentType has an
 * uploaded Document AND every required FormQuestion has a StudentAnswer.
 * Used to auto-flip status from PENDING to SUBMITTED after any upload or
 * answer, from both the document-upload and question-answer routes.
 */
export async function isFullySubmitted(studentId) {
  const [requiredDocTypes, documents, requiredQuestions, answers] = await Promise.all([
    prisma.documentType.findMany({ where: { required: true } }),
    prisma.document.findMany({ where: { studentId } }),
    prisma.formQuestion.findMany({ where: { required: true } }),
    prisma.studentAnswer.findMany({ where: { studentId } }),
  ]);

  const uploadedTypeIds = new Set(documents.map((d) => d.documentTypeId));
  const answeredQuestionIds = new Set(answers.map((a) => a.questionId));

  const docsDone = requiredDocTypes.every((t) => uploadedTypeIds.has(t.id));
  const questionsDone = requiredQuestions.every((q) => answeredQuestionIds.has(q.id));

  return docsDone && questionsDone;
}