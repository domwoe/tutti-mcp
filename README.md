# tutti-mcp

TypeScript package for anonymous, read-only tutti.ch search through two entry points:

- `tutti-mcp`: MCP stdio server exposing search, detail, categories, and locality lookup tools
- `tutti`: CLI with matching JSON-output commands

## Install

```sh
npm install
npm run build
```

Requires Node.js 20 or newer.

## MCP Usage

Run the built stdio server:

```sh
node /absolute/path/to/tutti-mcp/dist/mcp.js
```

Claude Code:

```sh
claude mcp add tutti -- node /absolute/path/to/tutti-mcp/dist/mcp.js
```

Claude Desktop:

```json
{
  "mcpServers": {
    "tutti": {
      "command": "node",
      "args": ["/absolute/path/to/tutti-mcp/dist/mcp.js"]
    }
  }
}
```

Cursor:

```json
{
  "mcpServers": {
    "tutti": {
      "command": "node",
      "args": ["/absolute/path/to/tutti-mcp/dist/mcp.js"]
    }
  }
}
```

Tools:

- `search_listings`: search listings. Prices are CHF. Pass `nextCursor` back as `cursor` for the next page. `location` accepts a Swiss place name and resolves to the top match.
- `get_listing`: fetch compact detail for one listing id, including description, seller, up to five image URLs, and the canonical tutti.ch URL.
- `get_categories`: return `{ id, label, children }` category nodes; ids are usable as `categoryId`.
- `search_localities`: search Swiss locality names before using location filters.

## CLI Usage

```sh
node dist/cli.js search velo --max 300 --limit 5
node dist/cli.js search velo --location "Zürich" --radius 10 --max 300
node dist/cli.js get 81828298
node dist/cli.js categories
node dist/cli.js localities "zür"
node dist/cli.js --help
node dist/cli.js --version
```

Installed package bins:

```sh
tutti search velo --max 300 --limit 5
tutti get 81828298
tutti categories
tutti localities "zür"
```

All CLI commands print JSON to stdout. Output is pretty-printed on a TTY and compact otherwise. Errors are written to stderr and return exit code 1.

## Development

```sh
npm run typecheck
npm test
npm run build
```

Live smoke tests are skipped by default. Run them explicitly:

```sh
TUTTI_LIVE=1 npm test
```

Useful manual checks:

```sh
node dist/cli.js search velo --max 300 --limit 5
npx @modelcontextprotocol/inspector node dist/mcp.js
```

## Notes

- Scope is anonymous read-only: search, listing detail, categories, and locality lookup.
- There is no login, messaging, favorites, posting, HTTP transport, caching, or bulk export.
- The implementation depends on `tutti-api`; `src/core/client.ts` is the only module importing it.
- Listing URLs use `https://www.tutti.ch/de/vi/<listingID>`.

## Legal Caveat

This package uses a reverse-engineered private API via the `tutti-api` npm package. tutti.ch's Nutzungsbedingungen prohibit automated queries and reproduction of listings. This project is intended for personal and prototype use only. It does not provide bulk-export or scraping features. Use it responsibly and respect tutti.ch's terms and rate limits.
