ALTER TABLE "User" ADD COLUMN "latitude" DOUBLE PRECISION, ADD COLUMN "longitude" DOUBLE PRECISION, ADD COLUMN "addressNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Store" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "latitude" DOUBLE PRECISION, ADD COLUMN "longitude" DOUBLE PRECISION, ADD COLUMN "locationNote" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Store_deletedAt_idx" ON "Store"("deletedAt");
CREATE INDEX "Listing_deletedAt_idx" ON "Listing"("deletedAt");
