-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "floatingKhipuFontSize" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "floatingKhipuHeight" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "floatingKhipuPosition" TEXT NOT NULL DEFAULT 'bottom-right',
ADD COLUMN     "floatingKhipuProvider" TEXT NOT NULL DEFAULT 'ollama',
ADD COLUMN     "floatingKhipuWidth" INTEGER NOT NULL DEFAULT 600;
