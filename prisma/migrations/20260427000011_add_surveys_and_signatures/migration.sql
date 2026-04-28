-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('text', 'single_choice', 'multi_choice', 'rating', 'yes_no');

-- CreateTable: surveys
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: survey_questions
CREATE TABLE "survey_questions" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "questionType" "SurveyQuestionType" NOT NULL,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: survey_responses
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "canvassResponseId" TEXT,
    "respondedById" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: signature_records
CREATE TABLE "signature_records" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "surveys_campaignId_idx" ON "surveys"("campaignId");
CREATE INDEX "surveys_deletedAt_idx" ON "surveys"("deletedAt");
CREATE INDEX "survey_questions_surveyId_idx" ON "survey_questions"("surveyId");
CREATE UNIQUE INDEX "survey_responses_canvassResponseId_key" ON "survey_responses"("canvassResponseId");
CREATE INDEX "survey_responses_surveyId_idx" ON "survey_responses"("surveyId");
CREATE INDEX "survey_responses_personId_idx" ON "survey_responses"("personId");
CREATE INDEX "signature_records_personId_idx" ON "signature_records"("personId");
CREATE INDEX "signature_records_campaignId_idx" ON "signature_records"("campaignId");

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_canvassResponseId_fkey" FOREIGN KEY ("canvassResponseId") REFERENCES "canvass_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_records" ADD CONSTRAINT "signature_records_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_records" ADD CONSTRAINT "signature_records_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_records" ADD CONSTRAINT "signature_records_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
