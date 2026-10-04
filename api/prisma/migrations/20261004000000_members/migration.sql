-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('SOLAR', 'LUNAR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "memberId" INTEGER;

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "gender" "Gender",
    "isDeceased" BOOLEAN NOT NULL DEFAULT false,
    "birthYear" INTEGER,
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "deathYear" INTEGER,
    "deathMonth" INTEGER,
    "deathDay" INTEGER,
    "deathCalendar" "CalendarType",
    "deathLunarLeap" BOOLEAN NOT NULL DEFAULT false,
    "anniversaryDay" INTEGER,
    "anniversaryMonth" INTEGER,
    "anniversaryCalendar" "CalendarType",
    "burialPlace" TEXT,
    "fatherId" INTEGER,
    "motherId" INTEGER,
    "birthOrder" INTEGER,
    "avatarPath" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marriage" (
    "id" SERIAL NOT NULL,
    "person1Id" INTEGER NOT NULL,
    "person2Id" INTEGER NOT NULL,
    "order" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Marriage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Member_fatherId_idx" ON "Member"("fatherId");

-- CreateIndex
CREATE INDEX "Member_motherId_idx" ON "Member"("motherId");

-- CreateIndex
CREATE INDEX "Member_searchName_idx" ON "Member"("searchName");

-- CreateIndex
CREATE INDEX "Member_fullName_generation_idx" ON "Member"("fullName", "generation");

-- CreateIndex
CREATE INDEX "Marriage_person2Id_idx" ON "Marriage"("person2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_person1Id_person2Id_key" ON "Marriage"("person1Id", "person2Id");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_person1Id_fkey" FOREIGN KEY ("person1Id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_person2Id_fkey" FOREIGN KEY ("person2Id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ràng buộc mà Prisma schema không diễn đạt được.
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_person_order_check" CHECK ("person1Id" < "person2Id");
ALTER TABLE "Member" ADD CONSTRAINT "Member_generation_check" CHECK ("generation" >= 1);
ALTER TABLE "Member" ADD CONSTRAINT "Member_not_own_parent_check"
  CHECK ("fatherId" IS DISTINCT FROM "id" AND "motherId" IS DISTINCT FROM "id");
