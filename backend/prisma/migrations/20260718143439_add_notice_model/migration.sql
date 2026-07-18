-- AlterTable
ALTER TABLE "DocumentType" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "templateFilePath" TEXT,
ADD COLUMN     "templateMimeType" TEXT,
ADD COLUMN     "templateOriginalName" TEXT;

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);
