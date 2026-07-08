import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";
import type { TuttiAdapter } from "./core/types.js";
import { createMcpServer, toolResult } from "./mcp.js";

const clients: Client[] = [];
const servers: McpServer[] = [];

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  await Promise.all(servers.map((server) => server.close()));
  clients.length = 0;
  servers.length = 0;
});

describe("createMcpServer", () => {
  it("registers the four tutti tools", async () => {
    const { client } = await createConnectedServer(fakeAdapter());
    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "get_categories",
      "get_listing",
      "search_listings",
      "search_localities"
    ]);
  });

  it("returns structured content and pretty JSON text for tool calls", async () => {
    const { client } = await createConnectedServer(fakeAdapter());

    const result = await client.callTool({
      name: "search_listings",
      arguments: { query: "velo", limit: 1 }
    }) as CallToolResult;

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      totalCount: 1,
      listings: [
        {
          id: "1",
          title: "Bike",
          price: "100.-",
          location: "8000 Zürich (ZH)",
          category: "Velos",
          timestamp: "2026-07-08T12:00:00+02:00",
          url: "https://www.tutti.ch/de/vi/1"
        }
      ],
      nextCursor: null
    });
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "")).toEqual(result.structuredContent);
  });
});

describe("toolResult", () => {
  it("returns one-line actionable errors without stack traces", async () => {
    const result = await toolResult(async () => {
      throw new Error("No locality matched Zurch\nat stack line");
    });

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "No locality matched Zurch" }]
    });
  });
});

async function createConnectedServer(adapter: TuttiAdapter): Promise<{ client: Client; server: McpServer }> {
  const server = createMcpServer(adapter, "0.1.0");
  const client = new Client({ name: "test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  servers.push(server);
  clients.push(client);

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  return { client, server };
}

function fakeAdapter(): TuttiAdapter {
  return {
    async search() {
      return {
        totalCount: 1,
        listings: [
          {
            id: "1",
            title: "Bike",
            price: "100.-",
            location: "8000 Zürich (ZH)",
            category: "Velos",
            timestamp: "2026-07-08T12:00:00+02:00",
            url: "https://www.tutti.ch/de/vi/1"
          }
        ],
        nextCursor: null
      };
    },
    async getListing(id) {
      return {
        id,
        title: "Bike",
        price: "100.-",
        location: "8000 Zürich (ZH)",
        category: "Velos",
        timestamp: "2026-07-08T12:00:00+02:00",
        url: `https://www.tutti.ch/de/vi/${id}`,
        description: "A bike",
        seller: null,
        images: [],
        address: null,
        source: null,
        language: "DE"
      };
    },
    async getCategories() {
      return [{ id: "bicycles", label: "Velos", children: [] }];
    },
    async searchLocalities() {
      return [{ id: "261", name: "Zürich", type: "CITY" }];
    }
  };
}
