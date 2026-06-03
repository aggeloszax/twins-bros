-- Baseline migration for the schema that already existed before
-- 202606040001_add_booking_cancel_token.

CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Barber" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "image" TEXT,

  CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,

  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleException" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "barberName" TEXT,
  "type" TEXT NOT NULL,
  "slotTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT,
  "noShow" BOOLEAN NOT NULL DEFAULT false,
  "barberId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,

  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_barberId_fkey"
FOREIGN KEY ("barberId") REFERENCES "Barber"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
