-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("phone")
);

