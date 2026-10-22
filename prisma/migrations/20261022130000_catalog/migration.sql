-- Merchant catalog: products (= Listing) in sections (= ListingGroup), store hours.
ALTER TABLE "Store" ADD COLUMN "openTime" TEXT, ADD COLUMN "closeTime" TEXT,
  ADD COLUMN "hoursNoteAr" TEXT NOT NULL DEFAULT '', ADD COLUMN "hoursNoteEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ListingGroup" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Listing" ADD COLUMN "unit" TEXT, ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "Listing_storeId_groupId_idx";
CREATE INDEX "Listing_storeId_groupId_position_idx" ON "Listing"("storeId", "groupId", "position");
-- Products now publish immediately (admin can still hide). Promote items waiting for review.
UPDATE "Listing" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
