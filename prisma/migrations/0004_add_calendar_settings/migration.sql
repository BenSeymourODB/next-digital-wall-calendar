-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "calendarRefreshIntervalMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "UserSettings" ADD COLUMN "calendarFetchMonthsAhead" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "UserSettings" ADD COLUMN "calendarFetchMonthsBehind" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "UserSettings" ADD COLUMN "calendarMaxEventsPerDay" INTEGER NOT NULL DEFAULT 3;
