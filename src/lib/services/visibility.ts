import type { Prisma } from "@prisma/client";

/**
 * Single source of truth for what the public may see.
 * Store: APPROVED and owner ACTIVE.
 * Listing: APPROVED, owner ACTIVE (if any), and its store public (if any).
 * Video: APPROVED and its parent public.
 */
export const STORE_PUBLIC: Prisma.StoreWhereInput = { status: "APPROVED", owner: { status: "ACTIVE" } };
export const LISTING_PUBLIC: Prisma.ListingWhereInput = {
  status: "APPROVED",
  AND: [
    { OR: [{ ownerId: null }, { owner: { status: "ACTIVE" } }] },
    { OR: [{ storeId: null }, { store: { is: STORE_PUBLIC } }] },
  ],
};

type StoreLike = { status: string; owner?: { status: string } | null };
type ListingLike = { status: string; owner?: { status: string } | null; store?: StoreLike | null };
export const isStorePublic = (s: StoreLike) => s.status === "APPROVED" && (!s.owner || s.owner.status === "ACTIVE");
export const isListingPublic = (l: ListingLike) =>
  l.status === "APPROVED" && (!l.owner || l.owner.status === "ACTIVE") && (!l.store || isStorePublic(l.store));

export const OWNER_STATUS = { select: { status: true } } as const;
