#!/usr/bin/env node
/**
 * @danadresse/mcp-server — Model Context Protocol server for Danadresse.
 *
 * Exposes 11 working tools backed by https://api.danadresse.dk to MCP-aware
 * AI clients (Claude Desktop, Claude Code, Cursor, Continue, Zed, etc.):
 *
 *   1. autocomplete_address   — typo-tolerant address search-as-you-type
 *   2. lookup_address         — full address details by UUID
 *   3. validate_address       — datavask (kategori A/B/C scoring)
 *   4. reverse_geocode        — coordinate → nearest address (WGS84 / ETRS89)
 *   5. enrich_with_dagi       — sogn, politikreds, retskreds, region, …
 *   6. property_data          — ejendom hub: valuation, zoning, energy, terrain, BBR
 *   7. distance_between       — haversine km + bearing between two address UUIDs
 *   8. address_quality_score  — 0–100 confidence score for partial input
 *   9. list_postnumre         — postal codes (by nr or name)
 *  10. list_kommuner          — municipalities (by kode or name)
 *  11. list_vejnavne          — street-name search
 *
 * Set DANADRESSE_API_KEY (recommended, 100k/mo on Basic). If omitted the
 * server runs against the free per-IP tier (1 000 calls/month).
 *
 *   "danadresse": {
 *     "command": "npx",
 *     "args": ["-y", "@danadresse/mcp-server"],
 *     "env": { "DANADRESSE_API_KEY": "dawa_live_..." }
 *   }
 *
 * Build: `npm run build`. Run from source: `npm run dev`.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { DanadresseClient, ApiError } from "./client.js";
import { TOOLS, type ToolName } from "./tools.js";

const VERSION = "1.0.0";

function getClient(): DanadresseClient {
  return new DanadresseClient({
    baseUrl: process.env.DANADRESSE_API_URL ?? "https://api.danadresse.dk",
    apiKey: process.env.DANADRESSE_API_KEY,
    userAgent: `danadresse-mcp/${VERSION} (+https://danadresse.dk)`,
    timeoutMs: Number(process.env.DANADRESSE_TIMEOUT_MS ?? 15_000),
  });
}

const TOOL_LIST: Tool[] = Object.values(TOOLS).map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: t.inputSchema,
}));

async function main(): Promise<void> {
  const client = getClient();

  const server = new Server(
    { name: "danadresse", version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_LIST,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name as ToolName;
    const tool = TOOLS[name];
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}. Available: ${Object.keys(TOOLS).join(", ")}`,
          },
        ],
      };
    }

    try {
      // Validate args against the tool's zod schema. We hand-roll the
      // mapping from JSONSchema → Zod (in tools.ts) so error messages line
      // up with the schema published in ListTools.
      const args = tool.zod.parse(req.params.arguments ?? {});
      const result = await tool.handler(client, args as never);
      // Surface the server's rate-limit state so the agent (and user) can see
      // how much of the monthly quota is left — same limits as a direct call.
      const rl = client.getRateLimit();
      const footer = rl
        ? `\n\n— rate limit: ${rl.remaining}/${rl.limit} calls remaining this month`
        : "";
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) + footer }],
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Invalid input for ${name}:\n${err.errors
                .map((e) => `- ${e.path.join(".") || "(root)"}: ${e.message}`)
                .join("\n")}`,
            },
          ],
        };
      }
      if (err instanceof ApiError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                `Danadresse API error (HTTP ${err.status}): ${err.message}` +
                (err.code ? `\nCode: ${err.code}` : "") +
                (err.hint ? `\nHint: ${err.hint}` : ""),
            },
          ],
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text", text: `Unexpected error: ${msg}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log a single line to STDERR so the host can see we booted.
  // STDOUT is reserved for the JSON-RPC framing — never write to it.
  process.stderr.write(
    `[danadresse-mcp ${VERSION}] ready — ${TOOL_LIST.length} tools registered ` +
      `(${process.env.DANADRESSE_API_KEY ? "authenticated" : "free tier"})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[danadresse-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
