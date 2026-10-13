-- Twins Bros becomes the only shop. Remove every row that belongs to any other
-- shop (Salut) before the tenant columns and tables are dropped. If the
-- twins-bros shop were missing, the subquery is NULL and nothing is deleted.
DELETE FROM "Booking"
WHERE "shopId" <> (SELECT "id" FROM "Shop" WHERE "slug" = 'twins-bros');

DELETE FROM "ScheduleException"
WHERE "shopId" <> (SELECT "id" FROM "Shop" WHERE "slug" = 'twins-bros');

DELETE FROM "Barber"
WHERE "shopId" <> (SELECT "id" FROM "Shop" WHERE "slug" = 'twins-bros');

DELETE FROM "Service"
WHERE "shopId" <> (SELECT "id" FROM "Shop" WHERE "slug" = 'twins-bros');

DELETE FROM "AdminCredential"
WHERE "shopId" <> (SELECT "id" FROM "Shop" WHERE "slug" = 'twins-bros');

-- The remaining admin credential becomes the fixed single row.
UPDATE "AdminCredential" SET "id" = 'admin';

-- DropForeignKey
ALTER TABLE "ShopDomain" DROP CONSTRAINT "ShopDomain_shopId_fkey";

-- DropForeignKey
ALTER TABLE "ShopWorkingPeriod" DROP CONSTRAINT "ShopWorkingPeriod_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Barber" DROP CONSTRAINT "Barber_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_shopId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleException" DROP CONSTRAINT "ScheduleException_shopId_fkey";

-- DropForeignKey
ALTER TABLE "AdminCredential" DROP CONSTRAINT "AdminCredential_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_shopId_fkey";

-- DropIndex
DROP INDEX "Barber_shopId_idx";

-- DropIndex
DROP INDEX "Barber_shopId_name_key";

-- DropIndex
DROP INDEX "Service_shopId_idx";

-- DropIndex
DROP INDEX "Service_shopId_name_key";

-- DropIndex
DROP INDEX "ScheduleException_shopId_date_idx";

-- DropIndex
DROP INDEX "AdminCredential_shopId_key";

-- DropIndex
DROP INDEX "Booking_shopId_startTime_idx";

-- DropIndex
DROP INDEX "Booking_shopId_barberId_startTime_idx";

-- AlterTable
ALTER TABLE "Barber" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "ScheduleException" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "AdminCredential" DROP COLUMN "shopId",
ALTER COLUMN "id" SET DEFAULT 'admin';

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "shopId";

-- DropTable
DROP TABLE "Shop";

-- DropTable
DROP TABLE "ShopDomain";

-- DropTable
DROP TABLE "ShopWorkingPeriod";

-- CreateIndex
CREATE UNIQUE INDEX "Barber_name_key" ON "Barber"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "ScheduleException_date_idx" ON "ScheduleException"("date");

-- CreateIndex
CREATE INDEX "Booking_startTime_idx" ON "Booking"("startTime");

-- CreateIndex
CREATE INDEX "Booking_barberId_startTime_idx" ON "Booking"("barberId", "startTime");

