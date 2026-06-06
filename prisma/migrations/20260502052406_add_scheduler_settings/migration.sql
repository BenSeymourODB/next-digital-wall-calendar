-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "schedulerIntervalSeconds" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "UserSettings" ADD COLUMN "schedulerPauseOnInteractionSeconds" INTEGER NOT NULL DEFAULT 30;
