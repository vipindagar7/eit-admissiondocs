-- CreateTable
CREATE TABLE "UploadAttemptLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentTypeId" TEXT,
    "attemptedFilename" TEXT,
    "attemptedMimeType" TEXT,
    "attemptedSizeBytes" INTEGER,
    "errorMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAttemptLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UploadAttemptLog" ADD CONSTRAINT "UploadAttemptLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
