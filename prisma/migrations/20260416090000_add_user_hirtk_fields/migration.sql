-- AlterTable
ALTER TABLE "User" ADD COLUMN "tenantNames" TEXT;
ALTER TABLE "User" ADD COLUMN "groupNames" TEXT;
ALTER TABLE "User" ADD COLUMN "roleNames" TEXT;
ALTER TABLE "User" ADD COLUMN "lastConnectionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "lastConnectionAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "lastDisconnectionAt" DATETIME;
