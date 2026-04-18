-- CreateTable
CREATE TABLE "SiteLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "hiRtkSiteLicenseEid" INTEGER NOT NULL,
    "licenseEntityId" INTEGER,
    "licenseName" TEXT,
    "licenseType" TEXT,
    "licenseColor" TEXT,
    "siteLicenseType" TEXT,
    "plan" TEXT,
    "sessionCount" INTEGER,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "expireStatus" BOOLEAN,
    "activeStatus" BOOLEAN,
    "agencyName" TEXT,
    "applicationName" TEXT,
    "note" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteLicense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteLicense_siteId_hiRtkSiteLicenseEid_key" ON "SiteLicense"("siteId", "hiRtkSiteLicenseEid");
CREATE INDEX "SiteLicense_siteId_idx" ON "SiteLicense"("siteId");
