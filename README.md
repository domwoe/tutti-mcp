# tutti-mcp

TypeScript package exposing anonymous, read-only tutti.ch search through two entry points:

- `tutti-mcp`: MCP stdio server for agents
- `tutti`: CLI with JSON output

## Install

```sh
npm install
npm run build
```

## MCP Usage

Claude Code:

```sh
claude mcp add tutti -- node /absolute/path/to/tutti-mcp/dist/mcp.js
```

MCP clients should run `dist/mcp.js` over stdio. The server exposes:

- `search_listings`
- `get_listing`
- `get_categories`
- `search_localities`

## CLI Usage

```sh
tutti search velo --max 300 --limit 5
tutti get 81828298
tutti categories
tutti localities "zür"
```

All CLI commands print JSON to stdout. Errors are written to stderr and exit with code 1.

## Legal Caveat

This package uses a reverse-engineered private API via the `tutti-api` npm package. tutti.ch's Nutzungsbedingungen prohibit automated queries and reproduction of listings. This project is intended for personal and prototype use only. It does not provide login, messaging, favorites, posting, bulk export, or scraping features.
