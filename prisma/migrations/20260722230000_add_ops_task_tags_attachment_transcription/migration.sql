ALTER TABLE "OpsTask"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "OpsAttachment"
ADD COLUMN "transcription" TEXT,
ADD COLUMN "transcriptionLanguage" TEXT,
ADD COLUMN "transcriptionConfidence" TEXT,
ADD COLUMN "transcriptionModel" TEXT;
