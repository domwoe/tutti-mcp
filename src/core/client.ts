import { TuttiClient, type Locality, type SearchBuilder } from "tutti-api";
import { mapCategoryTree, mapListingDetail, mapListingSummary, mapLocality } from "./mapping.js";
import type { CategoryNode, LocalitySummary, SearchResultPage, TuttiAdapter, TuttiSearchParams } from "./types.js";

let singleton: TuttiClient | null = null;

function getClient(): TuttiClient {
  singleton ??= new TuttiClient();
  return singleton;
}

export function createTuttiAdapter(client = getClient()): TuttiAdapter {
  return {
    async search(params: TuttiSearchParams): Promise<SearchResultPage> {
      const limit = normalizeLimit(params.limit);
      let resolvedLocation: Locality | undefined;
      let builder = client.search(params.query);

      if (params.categoryId) {
        builder = builder.category(params.categoryId);
      }

      if (params.freeOnly) {
        builder = builder.freeOnly();
      } else if (params.priceMin !== undefined || params.priceMax !== undefined) {
        builder = builder.price({ min: params.priceMin, max: params.priceMax });
      }

      if (params.location) {
        const matches = await client.localities.search(params.location);
        resolvedLocation = matches[0];
        if (!resolvedLocation) {
          throw new Error(`No locality matched "${params.location}" - try search_localities`);
        }
        builder = builder.location(resolvedLocation);

        if (params.radiusKm !== undefined) {
          builder = builder.radius(params.radiusKm);
        }
      }

      if (params.sort) {
        builder = builder.sort(params.sort, params.direction ?? "desc");
      } else if (params.direction) {
        builder = builder.sort("timestamp", params.direction);
      }

      if (params.cursor) {
        builder = builder.cursor(params.cursor);
      }

      const page = await builder.fetch();

      return {
        totalCount: page.totalCount,
        resolvedLocation: resolvedLocation?.name,
        listings: page.listings.slice(0, limit).map(mapListingSummary),
        nextCursor: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
      };
    },

    async getListing(id: string) {
      return mapListingDetail(await client.listings.get(id));
    },

    async getCategories(): Promise<CategoryNode[]> {
      return mapCategoryTree(await client.categories.tree());
    },

    async searchLocalities(text: string): Promise<LocalitySummary[]> {
      return (await client.localities.search(text)).map(mapLocality);
    }
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 15;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
    throw new Error("limit must be an integer between 1 and 30");
  }

  return limit;
}

export type { SearchBuilder };
