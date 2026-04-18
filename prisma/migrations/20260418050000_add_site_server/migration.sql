-- AlterTable
ALTER TABLE "Site" ADD COLUMN "server" TEXT NOT NULL DEFAULT 'AWS';

-- DropIndex
DROP INDEX IF EXISTS "Site_userId_hiRtkSiteEid_key";

-- CreateIndex
CREATE UNIQUE INDEX "Site_userId_server_hiRtkSiteEid_key" ON "Site"("userId", "server", "hiRtkSiteEid");
