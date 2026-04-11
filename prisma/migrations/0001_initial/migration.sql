-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('admin', 'standard');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('adult', 'teen', 'child');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "maxProfiles" INTEGER NOT NULL DEFAULT 10,
    "activeProfileId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultTaskPoints" INTEGER NOT NULL DEFAULT 10,
    "rewardSystemEnabled" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "defaultZoomLevel" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "showPointsOnCompletion" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskListConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lists" JSONB NOT NULL,
    "showCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortBy" TEXT NOT NULL DEFAULT 'dueDate',

    CONSTRAINT "TaskListConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPoints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProfileType" NOT NULL DEFAULT 'standard',
    "ageGroup" "AgeGroup" NOT NULL DEFAULT 'adult',
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "avatar" JSONB NOT NULL,
    "pinHash" TEXT,
    "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileRewardPoints" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileRewardPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "rewardPointsId" TEXT,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "taskId" TEXT,
    "taskTitle" TEXT,
    "awardedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSettings" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "defaultTaskListId" TEXT,
    "showCompletedTasks" BOOLEAN NOT NULL DEFAULT false,
    "taskSortOrder" TEXT NOT NULL DEFAULT 'dueDate',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'en',
    "enableNotifications" BOOLEAN NOT NULL DEFAULT false,
    "notificationTime" TEXT,

    CONSTRAINT "ProfileSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPoints_userId_key" ON "RewardPoints"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_isActive_idx" ON "Profile"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileRewardPoints_profileId_key" ON "ProfileRewardPoints"("profileId");

-- CreateIndex
CREATE INDEX "PointTransaction_profileId_createdAt_idx" ON "PointTransaction"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSettings_profileId_key" ON "ProfileSettings"("profileId");

-- CreateIndex
CREATE INDEX "TaskAssignment_profileId_taskId_idx" ON "TaskAssignment"("profileId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_profileId_key" ON "TaskAssignment"("taskId", "profileId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskListConfig" ADD CONSTRAINT "TaskListConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPoints" ADD CONSTRAINT "RewardPoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRewardPoints" ADD CONSTRAINT "ProfileRewardPoints_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_profile_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_awardedBy_fkey" FOREIGN KEY ("awardedBy") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_rewardPoints_fkey" FOREIGN KEY ("rewardPointsId") REFERENCES "ProfileRewardPoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSettings" ADD CONSTRAINT "ProfileSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
