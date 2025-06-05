-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('FULL', 'FAILED_ONLY', 'UNANSWERED_ONLY', 'REVIEW');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('COMPLETED', 'MASTERED', 'INCOMPLETE', 'ABANDONED');

-- CreateTable
CREATE TABLE "StudySessionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalCollectionId" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "originalCollectionSize" INTEGER NOT NULL,
    "sessionStartTime" TIMESTAMP(3) NOT NULL,
    "sessionEndTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "cardsInView" INTEGER NOT NULL,
    "cardsAttempted" INTEGER,
    "correctAnswers" INTEGER NOT NULL,
    "incorrectAnswers" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "finalStreak" INTEGER NOT NULL,
    "longestStreakInSession" INTEGER NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFlashcardSM2" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "easinessFactor" DOUBLE PRECISION NOT NULL,
    "repetitions" INTEGER NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "lastReviewed" TIMESTAMP(3) NOT NULL,
    "originalCollectionId" TEXT NOT NULL,
    "collectionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFlashcardSM2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStudyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalCollectionId" TEXT NOT NULL,
    "currentIndex" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "incorrectAnswers" INTEGER NOT NULL,
    "currentScore" INTEGER NOT NULL,
    "sessionCompleted" BOOLEAN NOT NULL,
    "flashcardsState" JSONB NOT NULL,
    "studyStats" JSONB NOT NULL,
    "sessionStartTime" TIMESTAMP(3) NOT NULL,
    "lastSavedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStudyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudySessionRecord_userId_idx" ON "StudySessionRecord"("userId");

-- CreateIndex
CREATE INDEX "StudySessionRecord_originalCollectionId_idx" ON "StudySessionRecord"("originalCollectionId");

-- CreateIndex
CREATE INDEX "UserFlashcardSM2_userId_idx" ON "UserFlashcardSM2"("userId");

-- CreateIndex
CREATE INDEX "UserFlashcardSM2_flashcardId_idx" ON "UserFlashcardSM2"("flashcardId");

-- CreateIndex
CREATE INDEX "UserFlashcardSM2_userId_dueDate_idx" ON "UserFlashcardSM2"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserFlashcardSM2_userId_flashcardId_key" ON "UserFlashcardSM2"("userId", "flashcardId");

-- CreateIndex
CREATE INDEX "UserStudyProgress_userId_idx" ON "UserStudyProgress"("userId");

-- CreateIndex
CREATE INDEX "UserStudyProgress_originalCollectionId_idx" ON "UserStudyProgress"("originalCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStudyProgress_userId_originalCollectionId_key" ON "UserStudyProgress"("userId", "originalCollectionId");

-- AddForeignKey
ALTER TABLE "StudySessionRecord" ADD CONSTRAINT "StudySessionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFlashcardSM2" ADD CONSTRAINT "UserFlashcardSM2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFlashcardSM2" ADD CONSTRAINT "UserFlashcardSM2_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStudyProgress" ADD CONSTRAINT "UserStudyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
