-- AlterTable
ALTER TABLE "Barber" ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageType" TEXT;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);


-- Move photos uploaded as base64 data URLs into imageData and point image at
-- the serving route. SET expressions all read the pre-update row.
UPDATE "Barber"
SET
  "imageType" = replace(substring("image" from '^data:(image/[a-zA-Z]+);base64,'), 'image/jpg', 'image/jpeg'),
  "imageData" = decode(substring("image" from 'base64,(.*)$'), 'base64'),
  "image" = '/api/barbers/' || "id" || '/image?v=' || floor(extract(epoch from now()) * 1000)::bigint::text
WHERE "image" LIKE 'data:image/%;base64,%';
