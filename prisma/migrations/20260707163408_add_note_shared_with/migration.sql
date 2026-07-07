-- AlterTable
ALTER TABLE "NoteTask" ADD COLUMN     "sharedWith" TEXT[] DEFAULT ARRAY[]::TEXT[];
