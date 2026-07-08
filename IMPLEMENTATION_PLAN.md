# tutti-mcp — Implementation Plan

Self-contained implementation plan for an executor agent. Everything needed is in this
document; the API facts below were verified live on 2026-07-08 — do not re-research them,
and do not deviate from the locked decisions without asking.

## 1. Goal

A TypeScript npm package `tutti-mcp` that lets agents search tutti.ch (Swiss classifieds)
via two entry points sharing one core:

- **`tutti-mcp`** — an MCP server (stdio transport) exposing 4 tools
- **`tutti`** — a CLI with matching subcommands, JSON output

## 2. Locked decisions (do not revisit)

| Decision | Choice |
|---|---|
| Scope | Anonymous read-only: search, listing detail, categories, locality lookup. No login, no messaging, no favorites, no posting. |
| API access | Depend on the `tutti-api` npm package (v2.1.1, MIT, zero runtime deps) behind a thin adapter module so it can be swapped later. Do not hand-roll GraphQL requests. |
| Entry points | MCP server **and** CLI, both thin layers over `src/core/`. |
| Transport | MCP stdio only. No HTTP server, no hosting concerns. |
| Language/runtime | TypeScript (strict), ESM, Node >= 20. |

## 3. Verified facts about tutti.ch (2026-07-08)

- tutti.ch has **no official public API**. The real backend is an Apollo GraphQL API at
  `https://api.tutti.ch/v10/graphql`, used by the official apps. Anonymous search works
  with app-identity headers and a random device hash — no API key, no login.
- The `tutti-api` package (github.com/filippofinke/tutti-api) wraps exactly this API and
  was last updated 2026-06-30. Verified working end-to-end (a search for "velo" returned
  14,876 listings).
- Canonical human URL for a listing: `https://www.tutti.ch/de/vi/<listingID>` —
  verified to 308-redirect to the full slugged listing page. Use this in outputs.
- The API sits behind Cloudflare. Abusive traffic will get blocked; see §7 (rate limiting).
- **Legal caveat (must appear in README):** this uses a reverse-engineered private API;
  tutti.ch's Nutzungsbedingungen prohibit automated queries and reproduction of listings.
  The package is for personal/prototype use. No bulk-export or scraping features.

### `tutti-api` surface you will use (from its README/source, v2.x)

```ts
import { TuttiClient } from "tutti-api";
const client = new TuttiClient();                      // anonymous; random device hash

// Fluent search — all filter methods optional, chainable
const result = await client
  .search("ledersofa")                                 // free-text query
  .category("furniture")                               // category id
  .price({ min: 100, max: 5000 })                      // or .freeOnly()
  .location(locality)                                  // Locality object (see below)
  .radius(20)                                          // km, with location
  .sort("timestamp", "desc")                           // SortField, "asc" | "desc"
  .cursor(endCursor)                                   // pagination
  .fetch();

result.totalCount;        // number
result.listings;          // Listing[] — this page (~30 items)
result.pageInfo;          // { hasNextPage, endCursor }
result.availableFilters;  // category-specific filters

await client.listings.get("81828298");                 // Listing (full detail)
await client.localities.search("zür");                 // Locality[] — needed for .location()
await client.categories.tree();                        // category tree
```

`Listing` fields (from `tutti-api` types): `listingID`, `title`, `address?`,
`formattedPrice?` (string like `"40.-"`), `primaryCategory? { categoryID, label }`,
`timestamp?`, `postcodeInformation? { postcode, locationName, canton { name, shortName } }`,
`thumbnail?`, `sellerInfo? { publicAccountID, alias }`, plus an index signature — the
detail response (`listings.get`) carries more fields (e.g. body text); log one real
response during development and map what's useful.

If a `tutti-api` signature differs from the above, trust the installed package's types.

## 4. Repository layout

```
tutti-mcp/
├── package.json            # name: tutti-mcp; bins: tutti-mcp, tutti; type: module
├── tsconfig.json           # strict, NodeNext
├── tsup.config.ts          # two entries: src/mcp.ts, src/cli.ts
├── README.md               # install, MCP config snippet, CLI usage, legal caveat
├── vitest.config.ts
└── src/
    ├── core/
    │   ├── client.ts       # createTuttiAdapter(): the ONLY file importing tutti-api
    │   ├── types.ts        # our compact output types (ListingSummary, ListingDetail, …)
    │   ├── mapping.ts      # tutti-api Listing -> compact types; buildListingUrl()
    │   └── throttle.ts     # rate limit + retry wrapper
    ├── mcp.ts              # MCP server entry (stdio)
    ├── cli.ts              # CLI entry (node:util parseArgs — no CLI framework)
    └── *.test.ts / core/*.test.ts
```

Dependencies: `tutti-api` (^2.1.1), `@modelcontextprotocol/sdk` (^1.29.0), `zod` (^4).
Dev: `typescript`, `tsup` (^8), `vitest` (^4). Nothing else.

## 5. Core adapter (`src/core/`)

`client.ts` exports one factory:

```ts
export interface TuttiSearchParams {
  query?: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  freeOnly?: boolean;
  location?: string;      // free-text place name, resolved internally (top match)
  radiusKm?: number;      // only with location
  sort?: "timestamp" | "price";   // default "timestamp"
  direction?: "asc" | "desc";     // default "desc"
  cursor?: string;        // pagination token from a previous page
  limit?: number;         // 1–30, default 15 — trim the page client-side
}

export interface TuttiAdapter {
  search(params: TuttiSearchParams): Promise<SearchResultPage>;
  getListing(id: string): Promise<ListingDetail>;
  getCategories(): Promise<CategoryNode[]>;
  searchLocalities(text: string): Promise<LocalitySummary[]>;
}
```

Behavior:
- `location` string → `client.localities.search(text)`, take the first result; if none,
  throw a clear error naming the unmatched text and suggesting the `search_localities`
  tool. Include the resolved locality name in the search result so the agent can see
  what was matched.
- One `TuttiClient` per process (module-level lazy singleton). Random device hash per
  process is fine — no session persistence in v1.

Compact output types (`types.ts`) — these are the tool/CLI payloads, keep them lean:

```ts
interface ListingSummary {
  id: string;
  title: string;
  price: string | null;          // formattedPrice as-is, e.g. "40.-"
  location: string | null;       // "6415 Arth (SZ)" built from postcodeInformation
  category: string | null;       // primaryCategory.label
  timestamp: string | null;
  url: string;                   // https://www.tutti.ch/de/vi/<id>
}

interface SearchResultPage {
  totalCount: number;
  resolvedLocation?: string;     // present when a location filter was applied
  listings: ListingSummary[];
  nextCursor: string | null;     // null when no further page
}

interface ListingDetail extends ListingSummary {
  description: string | null;    // body text from the detail response
  seller: { id: string; alias: string | null } | null;
  images: string[];              // rendition URLs, cap at 5
  // + any other clearly useful scalar fields found in the real detail response
}
```

Never pass raw `tutti-api` objects through to tools — always map. No thumbnails/images
in search results (token bloat); images only in `getListing`.

## 6. MCP server (`src/mcp.ts`)

Use `McpServer` + `StdioServerTransport` from `@modelcontextprotocol/sdk`, zod schemas
for inputs. Server name `tutti`, version from package.json. Four tools:

| Tool | Input | Returns |
|---|---|---|
| `search_listings` | all `TuttiSearchParams` fields | `SearchResultPage` |
| `get_listing` | `{ id: string }` | `ListingDetail` |
| `get_categories` | `{}` | category tree: `{ id, label, children }`, ids usable as `categoryId` |
| `search_localities` | `{ query: string }` | `{ id, name, type }[]` — for disambiguating places |

Tool descriptions must be written for an agent: say that prices are CHF, that
`nextCursor` feeds the `cursor` param for the next page, that `location` accepts a
Swiss place name and is resolved to the top match (use `search_localities` when
ambiguous), and that results link to tutti.ch pages.

Results: return the JSON payload as `structuredContent` **and** as pretty-printed JSON
in a `text` content block (some clients only read one). Errors: return `isError: true`
with a one-line actionable message (e.g. "No locality matched 'Zurch' — try
search_localities"), never a stack trace.

## 7. Rate limiting & errors (`core/throttle.ts`)

Wrap every adapter call:
- **Throttle:** min 700 ms between upstream requests (simple promise-chain mutex).
- **Retry:** on network errors, 429, and 5xx — max 2 retries, backoff 1 s then 3 s.
  Do not retry 4xx (except 429).
- **Cloudflare block:** a 403 with an HTML body means blocked — surface as
  "tutti.ch is rate-limiting this client; wait a few minutes" without retrying.

## 8. CLI (`src/cli.ts`)

`node:util` `parseArgs` — no commander/yargs. Output is JSON (pretty to TTY, compact
otherwise) on stdout; errors to stderr, exit 1.

```
tutti search <query> [--category id] [--min n] [--max n] [--free] \
      [--location name] [--radius km] [--sort timestamp|price] [--asc] \
      [--cursor c] [--limit n]
tutti get <listingId>
tutti categories
tutti localities <query>
tutti --help | --version
```

Each subcommand calls the same adapter methods as the MCP tools — no logic in the CLI
beyond arg parsing and printing.

## 9. Testing & verification

**Unit tests (vitest, no network):** mock the adapter (or `tutti-api` module) to test
mapping (`Listing` → `ListingSummary`, URL building, locality-not-found error), throttle
ordering, retry-on-429/no-retry-on-404, and CLI arg parsing.

**Live smoke tests** in `src/live.test.ts`, skipped unless `TUTTI_LIVE=1`:
1. `search({ query: "velo", priceMax: 300 })` → `totalCount > 0`, every listing has
   id/title/url, `nextCursor` non-null; fetch page 2 with it → different first id.
2. `getListing(<id from step 1>)` → title matches.
3. `searchLocalities("zür")` → includes Zürich; search with `location: "Zürich",
   radiusKm: 10` succeeds.

**Acceptance checklist (all must pass):**
- `npm run build && npm test` clean; `TUTTI_LIVE=1 npm test` clean.
- `npx @modelcontextprotocol/inspector node dist/mcp.js` lists 4 tools; `search_listings`
  with `{"query":"velo","priceMax":300}` returns real listings.
- `claude mcp add tutti -- node <abs>/dist/mcp.js`, then in Claude Code:
  "search tutti for a bike under 300 CHF in Zürich" produces listings with working URLs.
- `node dist/cli.js search velo --max 300 --limit 5` prints 5 listings as JSON.

## 10. Suggested commit sequence

1. Scaffold: package.json (bins, ESM), tsconfig, tsup, vitest, README skeleton.
2. `core/`: adapter + mapping + types, with unit tests against a captured fixture
   (run one real search, save the response shape as a JSON fixture).
3. Throttle/retry wrapper + tests.
4. MCP server + inspector verification.
5. CLI + tests.
6. Live smoke tests, README (config snippet for Claude Code/Desktop + Cursor, CLI
   examples, legal caveat), polish.

## 11. Out of scope for v1

Authenticated features (login, messaging, favorites), HTTP transport, session
persistence, result caching, bulk export, publishing to npm (build locally; publishing
is a human decision).
