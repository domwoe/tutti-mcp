import { describe, expect, it } from "vitest";
import type { TuttiAdapter, TuttiSearchParams } from "./core/types.js";
import { runCli } from "./cli.js";

describe("runCli", () => {
  it("maps search arguments to adapter params and prints compact JSON off TTY", async () => {
    const calls: TuttiSearchParams[] = [];
    const io = createIo(false);
    const code = await runCli(
      [
        "search",
        "velo",
        "--category",
        "bicycles",
        "--max",
        "300",
        "--location",
        "Zürich",
        "--radius",
        "10",
        "--asc",
        "--cursor",
        "abc",
        "--limit",
        "5"
      ],
      fakeAdapter({ search: async (params) => {
        calls.push(params);
        return { totalCount: 0, listings: [], nextCursor: null };
      } }),
      io
    );

    expect(code).toBe(0);
    expect(calls).toEqual([
      {
        query: "velo",
        categoryId: "bicycles",
        priceMin: undefined,
        priceMax: 300,
        freeOnly: undefined,
        location: "Zürich",
        radiusKm: 10,
        sort: undefined,
        direction: "asc",
        cursor: "abc",
        limit: 5
      }
    ]);
    expect(io.stdoutText).toBe('{"totalCount":0,"listings":[],"nextCursor":null}\n');
    expect(io.stderrText).toBe("");
  });

  it("prints pretty JSON to TTY", async () => {
    const io = createIo(true);
    const code = await runCli(["categories"], fakeAdapter(), io);

    expect(code).toBe(0);
    expect(io.stdoutText).toBe('[\n  {\n    "id": "bicycles",\n    "label": "Velos",\n    "children": []\n  }\n]\n');
  });

  it("supports get, localities, help, and version commands", async () => {
    const getIo = createIo(false);
    const localitiesIo = createIo(false);
    const helpIo = createIo(false);
    const versionIo = createIo(false);

    await expect(runCli(["get", "123"], fakeAdapter(), getIo)).resolves.toBe(0);
    await expect(runCli(["localities", "zür"], fakeAdapter(), localitiesIo)).resolves.toBe(0);
    await expect(runCli(["--help"], fakeAdapter(), helpIo)).resolves.toBe(0);
    await expect(runCli(["--version"], fakeAdapter(), versionIo, "9.9.9")).resolves.toBe(0);

    expect(JSON.parse(getIo.stdoutText)).toMatchObject({ id: "123", title: "Bike" });
    expect(JSON.parse(localitiesIo.stdoutText)).toEqual([{ id: "261", name: "Zürich", type: "CITY" }]);
    expect(helpIo.stdoutText).toContain("tutti search <query>");
    expect(versionIo.stdoutText).toBe("9.9.9\n");
  });

  it("writes errors to stderr and returns exit code 1", async () => {
    const io = createIo(false);
    const code = await runCli(["search", "velo", "--limit", "2.5"], fakeAdapter(), io);

    expect(code).toBe(1);
    expect(io.stdoutText).toBe("");
    expect(io.stderrText).toBe("--limit requires an integer\n");
  });
});

function createIo(isTTY: boolean) {
  let stdoutText = "";
  let stderrText = "";

  return {
    stdout: {
      isTTY,
      write(chunk: string) {
        stdoutText += chunk;
      }
    },
    stderr: {
      write(chunk: string) {
        stderrText += chunk;
      }
    },
    get stdoutText() {
      return stdoutText;
    },
    get stderrText() {
      return stderrText;
    }
  };
}

function fakeAdapter(overrides: Partial<TuttiAdapter> = {}): TuttiAdapter {
  return {
    async search() {
      return { totalCount: 1, listings: [], nextCursor: null };
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
    },
    ...overrides
  };
}
