import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createTuttiAdapter } from "./core/client.js";
import type { TuttiAdapter, TuttiSearchParams } from "./core/types.js";

interface CliIO {
  stdout: { write(chunk: string): void; isTTY?: boolean };
  stderr: { write(chunk: string): void };
}

const HELP = `Usage:
  tutti search <query> [--category id] [--min n] [--max n] [--free] [--location name] [--radius km] [--sort timestamp] [--asc] [--cursor c] [--limit n]
  tutti get <listingId>
  tutti categories
  tutti localities <query>
  tutti --help
  tutti --version`;

export async function runCli(
  argv = process.argv.slice(2),
  adapter: TuttiAdapter = createTuttiAdapter(),
  io: CliIO = { stdout: process.stdout, stderr: process.stderr },
  version = readVersion()
): Promise<number> {
  try {
    const command = argv[0];

    if (!command || command === "--help" || command === "-h") {
      io.stdout.write(`${HELP}\n`);
      return 0;
    }

    if (command === "--version" || command === "-v") {
      io.stdout.write(`${version}\n`);
      return 0;
    }

    switch (command) {
      case "search":
        printJson(io, await adapter.search(parseSearchArgs(argv.slice(1))));
        return 0;
      case "get":
        printJson(io, await adapter.getListing(requiredPositional(argv, 1, "listingId")));
        return 0;
      case "categories":
        ensureNoExtraPositionals(argv, 1);
        printJson(io, await adapter.getCategories());
        return 0;
      case "localities":
        printJson(io, await adapter.searchLocalities(requiredPositional(argv, 1, "query")));
        return 0;
      default:
        throw new Error(`Unknown command "${command}"`);
    }
  } catch (error) {
    io.stderr.write(`${oneLineError(error)}\n`);
    return 1;
  }
}

function parseSearchArgs(argv: string[]): TuttiSearchParams {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      category: { type: "string" },
      min: { type: "string" },
      max: { type: "string" },
      free: { type: "boolean" },
      location: { type: "string" },
      radius: { type: "string" },
      sort: { type: "string" },
      asc: { type: "boolean" },
      cursor: { type: "string" },
      limit: { type: "string" }
    }
  });

  const query = parsed.positionals[0];
  if (!query) {
    throw new Error("Missing required search query");
  }

  ensureNoExtraPositionals(parsed.positionals, 1);

  const sort = optionalEnum(parsed.values.sort, ["timestamp"], "sort");

  return {
    query,
    categoryId: parsed.values.category,
    priceMin: optionalNumber(parsed.values.min, "min"),
    priceMax: optionalNumber(parsed.values.max, "max"),
    freeOnly: parsed.values.free,
    location: parsed.values.location,
    radiusKm: optionalNumber(parsed.values.radius, "radius"),
    sort,
    direction: parsed.values.asc ? "asc" : undefined,
    cursor: parsed.values.cursor,
    limit: optionalInteger(parsed.values.limit, "limit")
  };
}

function printJson(io: CliIO, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value, null, io.stdout.isTTY ? 2 : 0)}\n`);
}

function requiredPositional(argv: string[], index: number, name: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing required ${name}`);
  }

  ensureNoExtraPositionals(argv, index + 1);
  return value;
}

function ensureNoExtraPositionals(positionals: string[], expectedCount: number): void {
  if (positionals.length > expectedCount) {
    throw new Error(`Unexpected argument "${positionals[expectedCount]}"`);
  }
}

function optionalNumber(value: string | boolean | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`--${name} requires a number`);
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`--${name} requires a number`);
  }

  return number;
}

function optionalInteger(value: string | boolean | undefined, name: string): number | undefined {
  const number = optionalNumber(value, name);
  if (number !== undefined && !Number.isInteger(number)) {
    throw new Error(`--${name} requires an integer`);
  }

  return number;
}

function optionalEnum<T extends string>(value: string | boolean | undefined, allowed: readonly T[], name: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`--${name} must be one of: ${allowed.join(", ")}`);
  }

  return value as T;
}

function oneLineError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/, 1)[0] || "Unknown error";
}

function readVersion(): string {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await runCli();
  process.exitCode = code;
}
