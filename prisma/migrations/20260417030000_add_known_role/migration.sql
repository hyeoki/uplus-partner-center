-- CreateTable
CREATE TABLE "KnownRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hiRtkRoleEid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "KnownRole_hiRtkRoleEid_key" ON "KnownRole"("hiRtkRoleEid");
CREATE UNIQUE INDEX "KnownRole_name_key" ON "KnownRole"("name");
