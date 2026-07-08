import { describe, expect, it } from "vitest";
import { createTuttiAdapter } from "./core/client.js";

const liveDescribe = process.env.TUTTI_LIVE === "1" ? describe : describe.skip;

liveDescribe("tutti.ch live smoke", () => {
  const adapter = createTuttiAdapter();

  it("searches, paginates, fetches detail, and searches by Zürich locality", async () => {
    const firstPage = await adapter.search({ query: "velo", priceMax: 300 });

    expect(firstPage.totalCount).toBeGreaterThan(0);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(firstPage.listings.length).toBeGreaterThan(0);

    for (const listing of firstPage.listings) {
      expect(listing.id).not.toBe("");
      expect(listing.title).not.toBe("");
      expect(listing.url).toBe(`https://www.tutti.ch/de/vi/${listing.id}`);
    }

    const secondPage = await adapter.search({ query: "velo", priceMax: 300, cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.listings[0]?.id).not.toBe(firstPage.listings[0]?.id);

    const detail = await adapter.getListing(firstPage.listings[0]?.id ?? "");
    expect(detail.title).toBe(firstPage.listings[0]?.title);

    const localities = await adapter.searchLocalities("zür");
    expect(localities.some((locality) => locality.name === "Zürich")).toBe(true);

    const zurichPage = await adapter.search({ query: "velo", location: "Zürich", radiusKm: 10, limit: 1 });
    expect(zurichPage.resolvedLocation).toBe("Zürich");
    expect(zurichPage.totalCount).toBeGreaterThan(0);
  }, 30000);
});
