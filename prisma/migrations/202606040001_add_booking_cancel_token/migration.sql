ALTER TABLE "Booking"
ADD COLUMN "cancelToken" TEXT;

UPDATE "Booking"
SET "cancelToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "cancelToken" IS NULL;

ALTER TABLE "Booking"
ALTER COLUMN "cancelToken" SET NOT NULL;

CREATE UNIQUE INDEX "Booking_cancelToken_key" ON "Booking"("cancelToken");
