-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "sheetRange" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "admissionStatus" TEXT,
ADD COLUMN     "allotmentRound" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "cetRank" TEXT,
ADD COLUMN     "cuetRank" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "feeStatus" TEXT,
ADD COLUMN     "fileNo" TEXT,
ADD COLUMN     "ipuFormFilledStatus" TEXT,
ADD COLUMN     "jeeRank" TEXT,
ADD COLUMN     "partAcademicFee" TEXT,
ADD COLUMN     "phone2" TEXT,
ADD COLUMN     "preference1" TEXT,
ADD COLUMN     "preference2" TEXT,
ADD COLUMN     "preference3" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "seatAllotedCourse" TEXT,
ADD COLUMN     "seatAllotmentStatus" TEXT,
ADD COLUMN     "srNo" INTEGER,
ADD COLUMN     "stateQuota" TEXT;
