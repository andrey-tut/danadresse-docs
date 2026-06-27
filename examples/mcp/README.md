# MCP server — Danish addresses for AI agents

[`@danadresse/mcp-server`](https://www.npmjs.com/package/@danadresse/mcp-server) is a
[Model Context Protocol](https://modelcontextprotocol.io) server that gives AI
agents (Claude Desktop, Claude Code, Cursor, Continue, Zed, …) direct access to
**2.4M Danish addresses** via the Danadresse API — the drop-in replacement for
DAWA (which closes 17 August 2026).

No install needed — `npx` fetches it on first run.

## Tools the agent gets

| Tool | Purpose |
|---|---|
| `autocomplete_address` | Typo-tolerant Danish address search-as-you-type |
| `lookup_address` | Full address record by UUID (DAR `id_lokalId`) |
| `validate_address` | Datavask — kategori A/B/C scoring of partial/dirty input |
| `reverse_geocode` | Coordinate → nearest address (WGS84 or ETRS89/UTM32N) |
| `enrich_with_dagi` | Sogn, politikreds, retskreds, region, opstillingskreds, … |
| `distance_between` | Haversine km + bearing between two address UUIDs |
| `address_quality_score` | 0–100 confidence + issue list for partial input |

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows) — see
[`claude_desktop_config.json`](claude_desktop_config.json) in this folder:

```json
{
  "mcpServers": {
    "danadresse": {
      "command": "npx",
      "args": ["-y", "@danadresse/mcp-server"],
      "env": { "DANADRESSE_API_KEY": "dawa_live_…" }
    }
  }
}
```

Restart Claude Desktop. Then ask: *"Validate the address Rådhuspladsen 1, 1550
København and tell me which parish (sogn) it's in."*

> **Not on npm yet?** If `npx @danadresse/mcp-server` reports the package can't be
> found, it hasn't been published yet. Run it from source meanwhile: clone this
> repo, `cd mcp-server && npm install && npm run build`, then point the config's
> `command` at `node` with `args` `["/abs/path/mcp-server/dist/index.js"]`.

## Claude Code

```bash
claude mcp add danadresse -- npx -y @danadresse/mcp-server
# then set the key in the generated config, or:
DANADRESSE_API_KEY=dawa_live_… claude mcp add danadresse -- npx -y @danadresse/mcp-server
```

## Cursor / Continue / Zed

Add the same `mcpServers` block to the editor's MCP settings file. The
`DANADRESSE_API_KEY` is optional — without it you get the free tier at a lower
rate limit; with it you get your plan's quota.

Get a key at <https://danadresse.dk>. Source: [`mcp-server/`](../../mcp-server).
