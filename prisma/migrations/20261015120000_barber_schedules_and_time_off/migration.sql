-- AlterTable
ALTER TABLE "Barber" ADD COLUMN     "customSchedule" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BarberWorkingPeriod" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "BarberWorkingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "barberId" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarberWorkingPeriod_barberId_idx" ON "BarberWorkingPeriod"("barberId");

-- CreateIndex
CREATE INDEX "TimeOff_endDate_idx" ON "TimeOff"("endDate");

-- AddForeignKey
ALTER TABLE "BarberWorkingPeriod" ADD CONSTRAINT "BarberWorkingPeriod_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

