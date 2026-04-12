-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loginId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT '골드',
    "role" TEXT NOT NULL DEFAULT 'partner',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "noticeId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emoji" TEXT NOT NULL,
    "noticeId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Reaction_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "colorId" TEXT NOT NULL DEFAULT 'blue',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Archive" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ext" TEXT,
    "size" TEXT,
    "url" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Archive_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_noticeId_emoji_userId_key" ON "Reaction"("noticeId", "emoji", "userId");
