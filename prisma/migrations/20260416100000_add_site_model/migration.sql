-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hiRtkSiteEid" INTEGER NOT NULL,
    "hiRtkTenantEid" INTEGER NOT NULL,
    "hiRtkPortalUserEid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "description" TEXT,
    "totalUserCount" INTEGER,
    "bookmark" BOOLEAN NOT NULL DEFAULT false,
    "hiRtkRegDate" DATETIME,
    "productName" TEXT,
    "productCode" TEXT,
    "productHost" TEXT,
    "productContextPath" TEXT,
    "userId" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Site_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_userId_hiRtkSiteEid_key" ON "Site"("userId", "hiRtkSiteEid");
CREATE INDEX "Site_userId_idx" ON "Site"("userId");
