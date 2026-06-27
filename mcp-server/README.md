# @danadresse/mcp-server

[Model Context Protocol](https://modelcontextprotocol.io) server giving AI agents direct access to **2.4 million Danish addresses** via [Danadresse](https://danadresse.dk) — the drop-in replacement for [DAWA](https://dawa.aws.dk) (which closes 17 August 2026).

Works with Claude Desktop, Claude Code, Cursor, Continue, Zed and any other MCP-aware client.

## What it does

The agent gets 7 tools:

| Tool | Purpose |
|---|---|
| `autocomplete_address` | Typo-tolerant Danish address search-as-you-type |
| `lookup_address` | Full address record by UUID (DAR `id_lokalId`) |
| `validate_address` | Datavask — kategori A/B/C scoring of partial/dirty input |
| `reverse_geocode` | Coordinate → nearest address (WGS84 or ETRS89/UTM32N) |
| `enrich_with_dagi` | Sogn, politikreds, retskreds, region, opstillingskreds, … |
| `distance_between` | Haversine km + bearing between two address UUIDs |
| `address_quality_score` | 0–100 confidence + issue list for partial input |

## Install

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "danadresse": {
      "command": "npx",
      "args": ["-y", "@danadresse/mcp-server"],
      "env": {
        "DANADRESSE_API_KEY": "dawa_live_…"
      }
    }
  }
}
```

Restart Claude Desktop. Look for the 🔌 icon in the input box — `danadresse` should appear with 7 tools.

### Claude Code

```bash
claude mcp add danadresse -- npx -y @danadresse/mcp-server
```

Or with an API key:

```bash
claude mcp add danadresse \
  --env DANADRESSE_API_KEY=dawa_live_… \
  -- npx -y @danadresse/mcp-server
```

### Cursor

`Settings → MCP → Add new MCP server`:

| Field | Value |
|---|---|
| Name | `danadresse` |
| Command | `npx -y @danadresse/mcp-server` |
| Env | `DANADRESSE_API_KEY=dawa_live_…` |

### Continue, Zed, etc.

Any MCP client that supports stdio transport works. The binary is `danadresse-mcp` (after `npm install -g`) or `npx @danadresse/mcp-server`.

## Get an API key

A key is **optional** — without one you get the free per-IP tier (1 000 calls/month). With a key, your quota is your plan's: Basic 100 000/month, Pro 500 000/month, Enterprise unlimited. The server reports the remaining monthly quota after each call and retries 429/5xx with backoff — same limits as calling the API directly.

1. Sign up at <https://danadresse.dk/dashboard/signup>
2. Create a key at <https://danadresse.dk/dashboard/keys>
3. Set `DANADRESSE_API_KEY` in the env block above

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `DANADRESSE_API_KEY` | — | Optional `X-Api-Key` header |
| `DANADRESSE_API_URL` | `https://api.danadresse.dk` | Override for staging/self-hosted |
| `DANADRESSE_TIMEOUT_MS` | `15000` | Per-request timeout |

## Examples — what the agent can do

```
You: Find the closest address to GPS 55.6761,12.5683 — and tell me which parish it belongs to.

Claude (uses 2 tools):
  → reverse_geocode { longitude: 12.5683, latitude: 55.6761 }
    ← { id: "041d4349-…", vejstykke: { navn: "Rådhuspladsen" }, husnr: "1" }
  → enrich_with_dagi { address_id: "041d4349-…" }
    ← { boundaries: { sogn: "Vor Frue Sogn", politikreds: "Københavns Politi", … } }

  "That's Rådhuspladsen 1, 1550 København V — part of Vor Frue Sogn,
   served by Københavns Politi."
```

```
You: Clean this CSV row: vejnavn="Raadhuspladsn", husnr="1", postnr="1550"

Claude:
  → validate_address { vejnavn: "Raadhuspladsn", husnr: "1", postnr: "1550" }
    ← { kategori: "B", resultater: [{ vejnavn: "Rådhuspladsen", husnr: "1", … }] }

  "Kategori B (sandsynlig korrektion). Suggested fix: Rådhuspladsen 1, 1550."
```

## Build from source

```bash
git clone https://github.com/andrey-tut/danadresse-mcp
cd danadresse-mcp
npm install
npm run build
node dist/index.js
```

Integration tests against live API:

```bash
INTEGRATION=1 npm run test:integration
```

## License

MIT © LynBro ApS. Address data is CC BY 4.0 from Klimadatastyrelsen (SDFI).
