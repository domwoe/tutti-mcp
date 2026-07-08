import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createTuttiAdapter } from "./core/client.js";
import type { TuttiAdapter } from "./core/types.js";

const searchInputSchema = {
  query: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  freeOnly: z.boolean().optional(),
  location: z.string().min(1).optional(),
  radiusKm: z.number().positive().optional(),
  sort: z.enum(["timestamp"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(30).optional()
};

const listingInputSchema = {
  id: z.string().min(1)
};

const localityInputSchema = {
  query: z.string().min(1)
};

export function createMcpServer(adapter: TuttiAdapter = createTuttiAdapter(), version = readPackageVersion()): McpServer {
  const server = new McpServer({ name: "tutti", version });

  server.registerTool(
    "search_listings",
    {
      title: "Search tutti.ch listings",
      description:
        "Search anonymous read-only tutti.ch listings. Prices are CHF. Use nextCursor as the cursor parameter for the next page. The location parameter accepts a Swiss place name and resolves to the top match; use search_localities first when ambiguous. Results include tutti.ch listing URLs.",
      inputSchema: searchInputSchema
    },
    async (params) => toolResult(() => adapter.search(params))
  );

  server.registerTool(
    "get_listing",
    {
      title: "Get a tutti.ch listing",
      description:
        "Fetch one tutti.ch listing by id. Returns compact listing detail with description, seller, up to five image URLs, and the canonical tutti.ch URL.",
      inputSchema: listingInputSchema
    },
    async ({ id }) => toolResult(() => adapter.getListing(id))
  );

  server.registerTool(
    "get_categories",
    {
      title: "Get tutti.ch categories",
      description:
        "Return the tutti.ch category tree as compact { id, label, children } nodes. Use ids as categoryId values when searching listings.",
      inputSchema: {}
    },
    async () => toolResult(() => adapter.getCategories())
  );

  server.registerTool(
    "search_localities",
    {
      title: "Search Swiss localities",
      description:
        "Search Swiss locality names for tutti.ch location filters. Use this to disambiguate place names before search_listings; search_listings resolves location text to the top match.",
      inputSchema: localityInputSchema
    },
    async ({ query }) => toolResult(() => adapter.searchLocalities(query))
  );

  return server;
}

export async function runMcpServer(adapter: TuttiAdapter = createTuttiAdapter()): Promise<void> {
  const server = createMcpServer(adapter);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function toolResult<T>(operation: () => Promise<T>): Promise<CallToolResult> {
  try {
    const payload = await operation();
    return {
      structuredContent: toStructuredContent(payload),
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: oneLineError(error) }]
    };
  }
}

function toStructuredContent(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return { value };
}

function oneLineError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/, 1)[0] || "Unknown tutti.ch error";
}

function readPackageVersion(): string {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpServer().catch((error: unknown) => {
    console.error(oneLineError(error));
    process.exitCode = 1;
  });
}
