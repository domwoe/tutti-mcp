import type { Listing, Locality } from "tutti-api";
import type { CategoryNode, ListingDetail, ListingSummary, LocalitySummary } from "./types.js";

const LISTING_URL_BASE = "https://www.tutti.ch/de/vi";

export function buildListingUrl(id: string): string {
  return `${LISTING_URL_BASE}/${encodeURIComponent(id)}`;
}

export function formatLocation(listing: Pick<Listing, "postcodeInformation" | "address">): string | null {
  const info = listing.postcodeInformation;
  const place = [info?.postcode, info?.locationName].filter(Boolean).join(" ").trim();
  const canton = info?.canton?.shortName;

  if (place && canton) {
    return `${place} (${canton})`;
  }

  return place || listing.address || null;
}

export function mapListingSummary(listing: Listing): ListingSummary {
  return {
    id: listing.listingID,
    title: listing.title,
    price: listing.formattedPrice ?? null,
    location: formatLocation(listing),
    category: listing.primaryCategory?.label ?? null,
    timestamp: listing.timestamp ?? null,
    url: buildListingUrl(listing.listingID)
  };
}

export function mapListingDetail(listing: Listing): ListingDetail {
  return {
    ...mapListingSummary(listing),
    description: stringField(listing.body),
    seller: listing.sellerInfo?.publicAccountID
      ? {
          id: listing.sellerInfo.publicAccountID,
          alias: listing.sellerInfo.alias ?? null
        }
      : null,
    images: imageUrls(listing),
    address: listing.address ?? null,
    source: listing.formattedSource ?? null,
    language: stringField(listing.language)
  };
}

export function mapLocality(locality: Locality): LocalitySummary {
  return {
    id: locality.localityID,
    name: locality.name,
    type: locality.localityType ?? null
  };
}

export function mapCategoryTree(raw: unknown): CategoryNode[] {
  const candidates = collectCategoryArrays(raw);
  const best = candidates.sort((a, b) => b.length - a.length)[0] ?? [];
  return best.map(mapCategoryNode).filter((node): node is CategoryNode => node !== null);
}

function mapCategoryNode(raw: unknown): CategoryNode | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = stringField(raw.categoryID ?? raw.id);
  const label = stringField(raw.label ?? raw.name);
  if (!id || !label) {
    return null;
  }

  const children = arrayField(raw.children ?? raw.subcategories ?? raw.childCategories)
    .map(mapCategoryNode)
    .filter((node): node is CategoryNode => node !== null);

  return { id, label, children };
}

function collectCategoryArrays(raw: unknown): unknown[][] {
  const arrays: unknown[][] = [];

  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      if (value.some(looksLikeCategory)) {
        arrays.push(value);
      }
      for (const item of value) {
        walk(item);
      }
      return;
    }

    if (isRecord(value)) {
      for (const child of Object.values(value)) {
        walk(child);
      }
    }
  }

  walk(raw);
  return arrays;
}

function looksLikeCategory(value: unknown): boolean {
  return isRecord(value) && typeof (value.categoryID ?? value.id) === "string" && typeof (value.label ?? value.name) === "string";
}

function imageUrls(listing: Listing): string[] {
  const images = arrayField(listing.images)
    .map((image) => (isRecord(image) && isRecord(image.rendition) ? stringField(image.rendition.src) : null))
    .filter((src): src is string => src !== null);

  if (images.length > 0) {
    return images.slice(0, 5);
  }

  const thumbnail = listing.thumbnail?.rendition?.src;
  return thumbnail ? [thumbnail] : [];
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
