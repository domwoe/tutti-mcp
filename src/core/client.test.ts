import type { Listing, Locality, PageInfo, SearchResult, TuttiClient } from "tutti-api";
import { describe, expect, it } from "vitest";
import { createTuttiAdapter } from "./client.js";

class FakeSearchBuilder {
  readonly calls: string[] = [];

  category(id: string): this {
    this.calls.push(`category:${id}`);
    return this;
  }

  price(price: { min?: number; max?: number }): this {
    this.calls.push(`price:${price.min ?? ""}-${price.max ?? ""}`);
    return this;
  }

  freeOnly(): this {
    this.calls.push("freeOnly");
    return this;
  }

  location(locality: Locality): this {
    this.calls.push(`location:${locality.localityID}`);
    return this;
  }

  radius(km: number): this {
    this.calls.push(`radius:${km}`);
    return this;
  }

  sort(field: "timestamp", direction: "asc" | "desc"): this {
    this.calls.push(`sort:${field}:${direction}`);
    return this;
  }

  cursor(cursor: string | null): this {
    this.calls.push(`cursor:${cursor ?? ""}`);
    return this;
  }

  async fetch(): Promise<Pick<SearchResult, "totalCount" | "listings" | "pageInfo">> {
    return {
      totalCount: 2,
      listings: [
        listing("1", "First"),
        listing("2", "Second")
      ],
      pageInfo: { hasNextPage: true, endCursor: "next" } satisfies PageInfo
    };
  }
}

describe("createTuttiAdapter", () => {
  it("resolves location text, applies filters, and trims results", async () => {
    const builder = new FakeSearchBuilder();
    const adapter = createTuttiAdapter(fakeClient(builder, [{ localityID: "261", name: "Zürich", localityType: "CITY" }]));

    await expect(
      adapter.search({
        query: "velo",
        categoryId: "bicycles",
        priceMax: 300,
        location: "Zürich",
        radiusKm: 10,
        direction: "asc",
        cursor: "cursor-1",
        limit: 1
      })
    ).resolves.toEqual({
      totalCount: 2,
      resolvedLocation: "Zürich",
      listings: [
        {
          id: "1",
          title: "First",
          price: null,
          location: null,
          category: null,
          timestamp: null,
          url: "https://www.tutti.ch/de/vi/1"
        }
      ],
      nextCursor: "next"
    });

    expect(builder.calls).toEqual([
      "category:bicycles",
      "price:-300",
      "location:261",
      "radius:10",
      "sort:timestamp:asc",
      "cursor:cursor-1"
    ]);
  });

  it("returns an actionable error when no locality matches", async () => {
    const adapter = createTuttiAdapter(fakeClient(new FakeSearchBuilder(), []));

    await expect(adapter.search({ query: "velo", location: "Zurch" })).rejects.toThrow(
      'No locality matched "Zurch" - try search_localities'
    );
  });

  it("validates the client-side limit", async () => {
    const adapter = createTuttiAdapter(fakeClient(new FakeSearchBuilder(), []));

    await expect(adapter.search({ limit: 31 })).rejects.toThrow("limit must be an integer between 1 and 30");
  });
});

function fakeClient(builder: FakeSearchBuilder, localities: Locality[]): TuttiClient {
  return {
    search: () => builder,
    localities: {
      search: async () => localities
    },
    listings: {
      get: async (id: string) => listing(id, "Detail")
    },
    categories: {
      tree: async () => ({ categories: [] })
    }
  } as unknown as TuttiClient;
}

function listing(id: string, title: string): Listing {
  return { listingID: id, title };
}
