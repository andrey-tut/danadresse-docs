# Danadresse API — examples

Copy-paste examples for the [Danadresse](https://danadresse.dk) API — the drop-in
replacement for [DAWA](https://dawa.aws.dk) (Danish Address Web API, closes
**17 August 2026**). Endpoints and JSON shapes are 1:1 with DAWA; migration is a
base-URL change plus an `X-Api-Key` header.

| File | Language |
|---|---|
| [`curl.sh`](curl.sh) | curl / shell |
| [`python_example.py`](python_example.py) | Python (stdlib) |
| [`javascript_example.js`](javascript_example.js) | JavaScript (Node 18+ / browser) |
| [`php_example.php`](php_example.php) | PHP |
| [`mcp/`](mcp) | MCP server for AI agents (Claude, Cursor, …) |

## Base URL & auth

```
https://api.danadresse.dk
```

- Header `X-Api-Key: dawa_live_…` (recommended) or query `?api_key=…`
- No key → free tier (lower per-IP rate limit)
- Get a key at <https://danadresse.dk>

## Typed clients

- **JavaScript/TypeScript:** `npm i @danadresse/client`
- **Python:** `pip install danadresse` (see [`clients/python`](../clients/python))
- **MCP (AI agents):** `npx @danadresse/mcp-server` (see [`mcp/`](mcp))
- **WordPress / WooCommerce:** [`clients/wordpress-plugin`](../clients/wordpress-plugin)
- **DAWA → Danadresse migration CLI:** [`clients/migrate-cli`](../clients/migrate-cli)

## Interactive API reference

Full OpenAPI spec: [`openapi.yaml`](../docs/openapi.yaml) ·
live docs at <https://danadresse.dk/docs> (Swagger) and
<https://danadresse.dk/redoc> (Redoc).
