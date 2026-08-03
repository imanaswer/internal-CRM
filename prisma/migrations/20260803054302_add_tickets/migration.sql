-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'WALK_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'TAKEN_UP', 'SOLVED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "num" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "branch" TEXT,
    "source" "TicketSource" NOT NULL,
    "ipAddress" TEXT,
    "assetId" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "takenById" TEXT,
    "takenAt" TIMESTAMP(3),
    "solvedById" TEXT,
    "solvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_num_key" ON "Ticket"("num");

-- CreateIndex
CREATE INDEX "Ticket_status_priority_idx" ON "Ticket"("status", "priority");

-- CreateIndex
CREATE INDEX "Ticket_contactPhone_idx" ON "Ticket"("contactPhone");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_solvedById_fkey" FOREIGN KEY ("solvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
