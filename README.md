# 🇨🇭 tutti MCP

> Search tutti.ch Swiss classifieds from your AI agent or the command line — **anonymous and read-only by design**.

[![npm version](https://img.shields.io/npm/v/tutti-mcp.svg)](https://www.npmjs.com/package/tutti-mcp)
[![npm downloads](https://img.shields.io/npm/dm/tutti-mcp.svg)](https://www.npmjs.com/package/tutti-mcp)
[![license](https://img.shields.io/npm/l/tutti-mcp.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/MCP-server-blue)](https://modelcontextprotocol.io)

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives any MCP-capable agent (Claude, Codex, Cursor, …) the ability to search listings on [`tutti.ch`](https://www.tutti.ch), fetch listing details, browse categories, and resolve Swiss localities. The same search core also ships as a `tutti` CLI with JSON output — handy for scripts and shell-based agents.

Ask your agent things like:

- *"Search tutti for a bike under 300 CHF in Zürich."*
- *"Find free sofas within 10 km of Bern."*
- *"Get details for tutti listing 81828298."*
- *"Which tutti categories are there for furniture?"*

**Why read-only?** No login, no messaging, no favorites, no posting, no bulk export. Nothing this server does can touch your account or spam sellers — an agent can browse freely with zero risk. See [Safety model](#safety-model).

---

## Quick start

```bash
npx -y tutti-mcp
```

The server speaks MCP over stdio, so you normally don't run it by hand — you point your MCP client at it and let the client spawn it. Pick your client below. Requires Node.js 20+.

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add tutti -- npx -y tutti-mcp
```

Restart Claude Code or start a new session after adding the server, then check `/mcp`.
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add this to your `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "tutti": {
      "command": "npx",
      "args": ["-y", "tutti-mcp"]
    }
  }
}
```

Restart Claude Desktop after editing the file.
</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
codex mcp add tutti -- npx -y tutti-mcp
```

Start a **new** Codex session after adding the server (MCP tools aren't injected into a running turn), then confirm with `/mcp` in the TUI.
</details>

<details>
<summary><strong>Cursor / other JSON-config clients</strong></summary>

Most clients accept a config of this shape:

```json
{
  "mcpServers": {
    "tutti": {
      "command": "npx",
      "args": ["-y", "tutti-mcp"]
    }
  }
}
```
</details>

No credentials, no configuration — the server works anonymously out of the box.

---

## Tools

All listing URLs use `https://www.tutti.ch/de/vi/<listingID>`. Prices are returned as tutti.ch formats them, in CHF — for example `"40.-"`.

| Tool | Purpose | Auth required | Writes? |
| --- | --- | :---: | :---: |
| `search_listings` | Search listings by query, category, price range, locality, radius, sort, and cursor. | No | No |
| `get_listing` | Fetch compact detail for one listing id, including description, seller, and up to five image URLs. | No | No |
| `get_categories` | Return `{ id, label, children }` category nodes; ids are usable as `categoryId`. | No | No |
| `search_localities` | Search Swiss locality names before using location filters. | No | No |

`search_listings` returns `nextCursor` when another page is available — pass that value back as `cursor` to get the next page.

When `location` is provided, the server resolves the text to the top matching Swiss locality. Use `search_localities` first when the place name is ambiguous or misspelled.

---

## Suggested workflows

**Find listings near a place**

1. `search_localities` for the place name if ambiguity matters.
2. `search_listings` with `location`, optional `radiusKm`, and price filters.
3. Follow `nextCursor` with another `search_listings` call for page 2.
4. `get_listing` for the items that need full details.

**Browse by category**

1. `get_categories` → 2. pick a category `id` → 3. `search_listings` with `categoryId`.

---

## CLI

The package also installs a `tutti` bin with subcommands mirroring the MCP tools:

```bash
# One-off with npx
npx -y -p tutti-mcp tutti search velo --max 300 --limit 5

# Or install globally
npm install -g tutti-mcp
tutti search velo --location "Zürich" --radius 10 --max 300
tutti get 81828298
tutti categories
tutti localities "zür"
```

```
Usage:
  tutti search <query> [--category id] [--min n] [--max n] [--free] [--location name] [--radius km] [--sort timestamp] [--asc] [--cursor c] [--limit n]
  tutti get <listingId>
  tutti categories
  tutti localities <query>
```

All commands print JSON to stdout — pretty-printed on a TTY, compact otherwise, so output pipes cleanly into `jq`. Errors go to stderr with exit code 1.

```bash
tutti search sofa --free --location Bern --radius 10 | jq '.listings[].title'
```

---

## Safety model

This server performs anonymous read-only operations only.

- No credentials are accepted or needed.
- No listings are posted, edited, favorited, or messaged.
- No HTTP server is exposed; MCP uses stdio only.
- No raw upstream objects are returned to agents — responses are mapped to compact, project-owned payloads.
- Upstream requests are throttled to avoid rapid repeated traffic and retried only for transient failures.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| MCP client doesn't show the tools | Restart the client or start a new session so it respawns the server. |
| `location` matches the wrong place | Run `search_localities` first, then use a more specific place name. |
| Search fails with a rate-limit message | Wait a few minutes before retrying; the upstream API is behind Cloudflare. |
| CLI output is one line | Expected when stdout is not a TTY — pipe it through `jq` if needed. |
| Live tests are skipped | Set `TUTTI_LIVE=1` explicitly. |
| Inspector command opens a UI instead of running once | Add `--cli` and an explicit `--method`, as shown below. |

---

## Develop from source

```bash
git clone https://github.com/domwoe/tutti-mcp.git
cd tutti-mcp
npm install
npm run build
```

Point a client at the built entrypoint:

```bash
claude mcp add tutti -- node /absolute/path/to/tutti-mcp/dist/mcp.js
```

### Verification

```bash
npm run typecheck
npm test
npm run build
```

Live smoke tests against the real upstream API are skipped by default:

```bash
TUTTI_LIVE=1 npm test
```

Manual MCP checks with the inspector:

```bash
npx @modelcontextprotocol/inspector --cli --method tools/list node dist/mcp.js
npx @modelcontextprotocol/inspector --cli node dist/mcp.js --method tools/call --tool-name search_listings --tool-arg query=velo --tool-arg priceMax=300
```

Manual CLI check:

```bash
node dist/cli.js search velo --max 300 --limit 5
```

---

## Legal caveat

This package uses a reverse-engineered private API via the [`tutti-api`](https://www.npmjs.com/package/tutti-api) npm package. tutti.ch has no official public API, and its Nutzungsbedingungen prohibit automated queries and reproduction of listings. This project is intended for personal and prototype use only — it deliberately provides no bulk-export or scraping features. Use it responsibly and respect tutti.ch's terms and rate limits.

## Disclaimer

This is an unofficial community project and is not affiliated with tutti.ch or SMG Swiss Marketplace Group.

## License

[MIT](./LICENSE)
