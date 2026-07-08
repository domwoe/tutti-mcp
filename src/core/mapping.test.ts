import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Listing } from "tutti-api";
import { describe, expect, it } from "vitest";
import { buildListingUrl, formatLocation, mapCategoryTree, mapListingDetail, mapListingSummary } from "./mapping.js";

const fixturePath = fileURLToPath(new URL("./__fixtures__/tutti-response.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { listing: Listing; detail: Listing };

describe("mapping", () => {
  it("builds canonical listing URLs", () => {
    expect(buildListingUrl("79488731")).toBe("https://www.tutti.ch/de/vi/79488731");
  });

  it("maps search listings to compact summaries", () => {
    expect(mapListingSummary(fixture.listing)).toEqual({
      id: "79488731",
      title: "Velo-Montageständer / Reparaturständer zu verkaufen",
      price: "80.-",
      location: "3007 Bern (BE)",
      category: "Velos",
      timestamp: "2026-07-08T22:10:11+02:00",
      url: "https://www.tutti.ch/de/vi/79488731"
    });
  });

  it("falls back to address when postcode data is missing", () => {
    expect(formatLocation({ address: "Lausanne", postcodeInformation: undefined })).toBe("Lausanne");
  });

  it("maps listing details without leaking raw API objects", () => {
    const detail = mapListingDetail(fixture.detail);

    expect(detail.description).toContain("Reparaturständer");
    expect(detail.seller).toEqual({ id: "8824920371437053126", alias: "Vira Kokhana" });
    expect(detail.images).toEqual([
      "https://c.tutti.ch/big/8910858404.jpg",
      "https://c.tutti.ch/big/5610760892.jpg",
      "https://c.tutti.ch/big/8826966569.jpg"
    ]);
    expect(detail.language).toBe("DE");
    expect(detail).not.toHaveProperty("sellerInfo");
    expect(detail).not.toHaveProperty("postcodeInformation");
  });

  it("defensively maps category trees from unmodeled raw responses", () => {
    expect(
      mapCategoryTree({
        categories: [
          {
            categoryID: "sportsOutdoors",
            label: "Sport & Outdoor",
            children: [{ categoryID: "bicycles", label: "Velos" }]
          }
        ]
      })
    ).toEqual([
      {
        id: "sportsOutdoors",
        label: "Sport & Outdoor",
        children: [{ id: "bicycles", label: "Velos", children: [] }]
      }
    ]);
  });
});
