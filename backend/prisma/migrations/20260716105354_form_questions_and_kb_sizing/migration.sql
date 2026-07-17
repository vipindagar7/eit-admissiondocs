-- AlterTable
ALTER TABLE "DocumentType" ADD COLUMN     "allowedMimeTypes" TEXT NOT NULL DEFAULT 'application/pdf,image/jpeg,image/png',
ADD COLUMN     "maxSizeMB" INTEGER NOT NULL DEFAULT 5;
