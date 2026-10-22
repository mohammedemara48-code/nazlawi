export type MProduct = {
  id: string; groupId: string | null; nameAr: string; nameEn: string; descAr: string; descEn: string;
  priceMinor: number | null; oldPriceMinor: number | null; unit: string | null; unitAr: string; unitEn: string;
  available: boolean; latitude?: number | null; longitude?: number | null; locationNote?: string; featuredPosition: number | null; position: number; status: string;
  images: { id: string; key: string }[];
};
export type MSection = { id: string; nameAr: string; nameEn: string; position: number; productCount?: number };
export const OTHER = "__other";
