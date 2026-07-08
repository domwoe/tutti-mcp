# tutti-mcp

> Search tutti.ch Swiss classifieds from an AI agent or a JSON CLI — anonymous and read-only.

[![MCP](https://img.shields.io/badge/MCP-server-blue)](https://modelcontextprotocol.io)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

`tutti-mcp` exposes the same compact tutti.ch search core through two entry points:

- `tutti-mcp`: MCP stdio server for Claude, Codex, Cursor, and other MCP-capable clients
- `tutti`: CLI with matching subcommands and JSON output

Ask your agent things like:

- "Search tutti for a bike under 300 CHF in Zürich."
- "Find free sofas near Bern."
- "Get details for tutti listing 81828298."
- "Show me the available tutti categories."

The package is intentionally anonymous read-only: no login, messaging, favorites, posting, caching, or bulk export.

---

## Quick Start

Run from a local checkout:

```sh
npm install
npm run build
node dist/cli.js search velo --max 300 --limit 5
```

The MCP server speaks stdio, so you normally let your client spawn it.

<details>
<summary><strong>Claude Code</strong></summary>

```sh
claude mcp add tutti -- node /absolute/path/to/tutti-mcp/dist/mcp.js
```

Restart Claude Code or start a new session after adding the server, then check `/mcp`.
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add this to `claude_desktop_config.json`:

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

Restart Claude Desktop after editing the file.
</details>

<details>
<summary><strong>Codex</strong></summary>

```sh
codex mcp add tutti -- node /absolute/path/to/tutti-mcp/dist/mcp.js
```

Start a new Codex session after adding the server; MCP tools are injected when the session starts.
</details>

<details>
<summary><strong>Cursor / other JSON-config clients</strong></summary>

Most clients accept a config of this shape:

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
</details>

Requires Node.js 20 or newer.

---

## Tools

All listing URLs use `https://www.tutti.ch/de/vi/<listingID>`. Prices are returned as tutti.ch formats in CHF, for example `"40.-"`.

| Tool | Purpose | Auth required | Writes? |
| --- | --- | :---: | :---: |
| `search_listings` | Search listings by query, category, price, locality, radius, sort, and cursor. | No | No |
| `get_listing` | Fetch compact detail for one listing id, including description, seller, and up to five image URLs. | No | No |
| `get_categories` | Return `{ id, label, children }` category nodes; ids are usable as `categoryId`. | No | No |
| `search_localities` | Search Swiss locality names before using location filters. | No | No |

`search_listings` returns `nextCursor` when another page is available. Pass that value back as `cursor`.

When `location` is provided, the server resolves the text to the top matching Swiss locality. Use `search_localities` first when the place name is ambiguous or misspelled.

---

## Suggested Workflows

**Find listings near a place**

1. `search_localities` for the place name if ambiguity matters.
2. `search_listings` with `location`, optional `radiusKm`, and price filters.
3. Follow `nextCursor` with another `search_listings` call for page 2.
4. Use `get_listing` for the items that need full details.

**Browse by category**

1. `get_categories`.
2. Pick a category `id`.
3. `search_listings` with `categoryId`.

**Use from the CLI**

```sh
node dist/cli.js search velo --max 300 --limit 5
node dist/cli.js search velo --location "Zürich" --radius 10 --max 300
node dist/cli.js get 81828298
node dist/cli.js categories
node dist/cli.js localities "zür"
```

Installed package bins:

```sh
tutti search velo --max 300 --limit 5
tutti get 81828298
tutti categories
tutti localities "zür"
```

All CLI commands print JSON to stdout. Output is pretty-printed on a TTY and compact otherwise. Errors are written to stderr and return exit code 1.

---

## Safety Model

This server performs anonymous read-only operations only.

- No credentials are accepted or needed.
- No listings are posted, edited, favorited, or messaged.
- No HTTP server is exposed; MCP uses stdio only.
- No raw `tutti-api` objects are returned to agents. Responses are mapped to compact project-owned payloads.
- Upstream requests are throttled to avoid rapid repeated traffic and retried only for transient failures.

---

## Develop From Source

```sh
cd tutti-mcp
npm install
npm run build
```

Point a client at the built entrypoint:

```sh
claude mcp add tutti -- node /absolute/path/to/tutti-mcp/dist/mcp.js
```

### Verification

```sh
npm run typecheck
npm test
npm run build
```

Live smoke tests are skipped by default:

```sh
TUTTI_LIVE=1 npm test
```

Manual MCP checks:

```sh
npx @modelcontextprotocol/inspector --cli --method tools/list node dist/mcp.js
npx @modelcontextprotocol/inspector --cli node dist/mcp.js --method tools/call --tool-name search_listings --tool-arg query=velo --tool-arg priceMax=300
```

Manual CLI check:

```sh
node dist/cli.js search velo --max 300 --limit 5
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| MCP client does not show the tools | Restart the client or start a new session so it respawns the server. |
| `location` matches the wrong place | Run `search_localities` first, then use a more specific place name. |
| Search fails with a rate-limit message | Wait a few minutes before retrying; the upstream API is behind Cloudflare. |
| CLI output is one line | Expected when stdout is not a TTY; pipe it through `jq` if needed. |
| Live tests are skipped | Set `TUTTI_LIVE=1` explicitly. |
| Inspector command opens a UI instead of running once | Add `--cli` and an explicit `--method`, as shown above. |

---

## Legal Caveat

This package uses a reverse-engineered private API via the `tutti-api` npm package. tutti.ch has no official public API, and its Nutzungsbedingungen prohibit automated queries and reproduction of listings. This project is intended for personal and prototype use only. It does not provide bulk-export or scraping features. Use it responsibly and respect tutti.ch's terms and rate limits.

## Disclaimer

This is an unofficial community project and is not affiliated with tutti.ch or SMG Swiss Marketplace Group.

## License

MIT
