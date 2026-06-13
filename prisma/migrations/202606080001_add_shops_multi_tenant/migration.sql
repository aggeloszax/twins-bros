-- Create the tenant table first so existing single-shop rows can be attached
-- to the default Twins Bros shop during this migration.
CREATE TABLE "Shop" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

INSERT INTO "Shop" ("id", "slug", "name", "updatedAt")
VALUES
  ('shop_twins_bros', 'twins-bros', 'Twins Bros', CURRENT_TIMESTAMP),
  ('shop_salut', 'salut', 'SALUT', CURRENT_TIMESTAMP);

ALTER TABLE "Barber" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Service" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "shopId" TEXT;
ALTER TABLE "ScheduleException" ADD COLUMN "shopId" TEXT;
ALTER TABLE "AdminCredential" ADD COLUMN "shopId" TEXT;

UPDATE "Barber" SET "shopId" = 'shop_twins_bros' WHERE "shopId" IS NULL;
UPDATE "Service" SET "shopId" = 'shop_twins_bros' WHERE "shopId" IS NULL;
UPDATE "Booking" SET "shopId" = 'shop_twins_bros' WHERE "shopId" IS NULL;
UPDATE "ScheduleException" SET "shopId" = 'shop_twins_bros' WHERE "shopId" IS NULL;
UPDATE "AdminCredential" SET "shopId" = 'shop_twins_bros' WHERE "shopId" IS NULL;

ALTER TABLE "Barber" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "ScheduleException" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "AdminCredential" ALTER COLUMN "shopId" SET NOT NULL;

CREATE UNIQUE INDEX "Barber_shopId_name_key" ON "Barber"("shopId", "name");
CREATE INDEX "Barber_shopId_idx" ON "Barber"("shopId");
CREATE UNIQUE INDEX "Service_shopId_name_key" ON "Service"("shopId", "name");
CREATE INDEX "Service_shopId_idx" ON "Service"("shopId");
CREATE INDEX "Booking_shopId_startTime_idx" ON "Booking"("shopId", "startTime");
CREATE INDEX "Booking_shopId_barberId_startTime_idx" ON "Booking"("shopId", "barberId", "startTime");
CREATE INDEX "ScheduleException_shopId_date_idx" ON "ScheduleException"("shopId", "date");
CREATE UNIQUE INDEX "AdminCredential_shopId_key" ON "AdminCredential"("shopId");

ALTER TABLE "Barber" ADD CONSTRAINT "Barber_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminCredential" ADD CONSTRAINT "AdminCredential_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
