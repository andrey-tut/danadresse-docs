/**
 * MCP tool registry — definitions + handlers.
 *
 * Each entry has:
 *   - JSONSchema (sent to the MCP client) so the LLM knows the shape
 *   - Zod schema (used at runtime to validate)
 *   - handler that calls the Danadresse HTTP client
 *
 * The two schemas are kept in sync by hand — small surface, simple types.
 */

import { z } from "zod";
import type { DanadresseClient } from "./client.js";

// MCP SDK requires inputSchema.type to be literally "object".
interface JsonSchema {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
  [extra: string]: unknown;
}

interface ToolDef<S extends z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  zod: S;
  handler: (client: DanadresseClient, args: z.infer<S>) => Promise<unknown>;
}

// ──────────────────────────────────────────────────────────────────────
// 1. autocomplete_address
// ──────────────────────────────────────────────────────────────────────
const autocompleteZ = z.object({
  query: z.string().min(2).max(200).describe("Partial address text"),
  fuzzy: z.boolean().optional().default(true),
  type: z
    .enum(["vejnavn", "vejnavn+husnr", "adgangsadresse", "adresse"])
    .optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

const autocomplete: ToolDef<typeof autocompleteZ> = {
  name: "autocomplete_address",
  description:
    "Typo-tolerant Danish address search-as-you-type. Returns up to N matching " +
    "suggestions with their tekst label, type, and underlying data (UUIDs, postnr, " +
    "kommune, coordinates). Use this when the user asks 'find address ...', " +
    "'search for ...', or wants to identify a UUID before calling lookup_address / " +
    "validate_address / enrich_with_dagi.",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        minLength: 2,
        maxLength: 200,
        description: "Partial address text — vejnavn, postnr, or any combination.",
      },
      fuzzy: {
        type: "boolean",
        default: true,
        description: "Allow typo-tolerance via Meilisearch's edit-distance.",
      },
      type: {
        type: "string",
        enum: ["vejnavn", "vejnavn+husnr", "adgangsadresse", "adresse"],
        description:
          "Restrict result granularity. Default returns the most specific match available.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 10,
        description: "Maximum number of suggestions.",
      },
    },
    additionalProperties: false,
  },
  zod: autocompleteZ,
  handler: async (client, args) => {
    const hits = await client.autocomplete({
      q: args.query,
      fuzzy: args.fuzzy,
      type: args.type,
      perSide: args.limit,
    });
    return {
      query: args.query,
      count: hits.length,
      results: hits.map((h) => ({
        tekst: h.tekst,
        type: h.type,
        id: (h.data as { id?: string }).id,
        data: h.data,
      })),
    };
  },
};

// ──────────────────────────────────────────────────────────────────────
// 2. lookup_address
// ──────────────────────────────────────────────────────────────────────
const lookupZ = z.object({
  id: z.string().uuid().describe("Address UUID (DAR id_lokalId / DAWA id)"),
  kind: z
    .enum(["adresse", "adgangsadresse"])
    .optional()
    .default("adresse")
    .describe(
      "'adresse' returns full address (with floor/door). 'adgangsadresse' returns the entry-level (one per building)."
    ),
});

const lookup: ToolDef<typeof lookupZ> = {
  name: "lookup_address",
  description:
    "Fetch the complete record for a known address UUID. Use this after " +
    "autocomplete_address has returned a candidate's id, or when the user " +
    "supplies a UUID directly. Returns vejnavn, husnr, postnr, kommune, " +
    "WGS84 coordinates, and all DAWA-shape nested objects.",
  inputSchema: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid", description: "Address UUID" },
      kind: {
        type: "string",
        enum: ["adresse", "adgangsadresse"],
        default: "adresse",
      },
    },
    additionalProperties: false,
  },
  zod: lookupZ,
  handler: async (client, args) => {
    return args.kind === "adgangsadresse"
      ? client.lookupAdgangsadresse(args.id)
      : client.lookupAddress(args.id);
  },
};

// ──────────────────────────────────────────────────────────────────────
// 3. validate_address
// ──────────────────────────────────────────────────────────────────────
const validateZ = z.object({
  vejnavn: z.string().optional().describe("Street name (allowed to contain typos)"),
  husnr: z.string().optional().describe("House number, e.g. '1', '12A'"),
  etage: z.string().optional().describe("Floor — 'st', 'kl', '1'..'99'"),
  door: z.string().optional().describe("Door — 'tv', 'th', 'mf', or '1'..'9999'"),
  postnr: z.string().optional().describe("4-digit postnummer"),
  supplerendebynavn: z.string().optional(),
});

const validate: ToolDef<typeof validateZ> = {
  name: "validate_address",
  description:
    "Clean a partial / typoed Danish address against DAR. Returns kategori " +
    "(A = exact, B = sandsynlig korrektion, C = uncertain) and the top 5 " +
    "candidate full addresses with per-field status (ok / korrigeret). " +
    "Use this for CRM imports, checkout validation, or any 'is this address real?' " +
    "decision before storing it.",
  inputSchema: {
    type: "object",
    properties: {
      vejnavn: { type: "string" },
      husnr: { type: "string" },
      etage: { type: "string" },
      door: { type: "string" },
      postnr: { type: "string", pattern: "^\\d{4}$" },
      supplerendebynavn: { type: "string" },
    },
    additionalProperties: false,
  },
  zod: validateZ,
  handler: async (client, args) => client.validateAddress(args),
};

// ──────────────────────────────────────────────────────────────────────
// 4. reverse_geocode
// ──────────────────────────────────────────────────────────────────────
const reverseZ = z.object({
  longitude: z.number().describe("Longitude (WGS84) or East (ETRS89/UTM32N)"),
  latitude: z.number().describe("Latitude (WGS84) or North (ETRS89/UTM32N)"),
  srid: z
    .union([z.literal(4326), z.literal(25832)])
    .optional()
    .default(4326)
    .describe("4326 = WGS84 (default), 25832 = ETRS89/UTM32N"),
});

const reverse: ToolDef<typeof reverseZ> = {
  name: "reverse_geocode",
  description:
    "Find the nearest Danish address to a coordinate pair. WGS84 (lat/lon) by " +
    "default, or ETRS89/UTM32N when srid=25832. Returns the full adgangsadresse " +
    "with vejnavn, husnr, postnr, kommune, coordinates, and accuracy.",
  inputSchema: {
    type: "object",
    required: ["longitude", "latitude"],
    properties: {
      longitude: { type: "number" },
      latitude: { type: "number" },
      srid: { type: "integer", enum: [4326, 25832], default: 4326 },
    },
    additionalProperties: false,
  },
  zod: reverseZ,
  handler: async (client, args) =>
    client.reverseGeocode({ x: args.longitude, y: args.latitude, srid: args.srid }),
};

// ──────────────────────────────────────────────────────────────────────
// 5. enrich_with_dagi
// ──────────────────────────────────────────────────────────────────────
const dagiZ = z.object({
  address_id: z.string().uuid().describe("Adgangsadresse UUID"),
});

const dagi: ToolDef<typeof dagiZ> = {
  name: "enrich_with_dagi",
  description:
    "Return every administrative-area (DAGI) layer for an address: sogn, " +
    "politikreds, retskreds, region, landsdel, opstillingskreds, " +
    "afstemningsområde, valglandsdel. Useful for 'which parish?', " +
    "'which police district?', civic-service routing, and demographic analysis.",
  inputSchema: {
    type: "object",
    required: ["address_id"],
    properties: {
      address_id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
  zod: dagiZ,
  handler: async (client, args) => client.enrichDagi(args.address_id),
};

// ──────────────────────────────────────────────────────────────────────
// 6. distance_between
// ──────────────────────────────────────────────────────────────────────
const distZ = z.object({
  from_id: z.string().uuid().describe("Source adgangsadresse UUID"),
  to_id: z.string().uuid().describe("Destination adgangsadresse UUID"),
});

const distance: ToolDef<typeof distZ> = {
  name: "distance_between",
  description:
    "Great-circle distance between two Danish addresses. Returns km, m, " +
    "miles, plus initial compass bearing (degrees + 16-point compass). " +
    "Use for delivery zone checks, last-mile costing, 'how far is X from Y?'.",
  inputSchema: {
    type: "object",
    required: ["from_id", "to_id"],
    properties: {
      from_id: { type: "string", format: "uuid" },
      to_id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
  zod: distZ,
  handler: async (client, args) => client.distance(args.from_id, args.to_id),
};

// ──────────────────────────────────────────────────────────────────────
// 7. address_quality_score
// ──────────────────────────────────────────────────────────────────────
const qualityZ = z.object({
  vejnavn: z.string().optional(),
  husnr: z.string().optional(),
  etage: z.string().optional(),
  door: z.string().optional(),
  postnr: z.string().optional(),
  postnr_navn: z.string().optional(),
  kommunekode: z.string().optional(),
});

const quality: ToolDef<typeof qualityZ> = {
  name: "address_quality_score",
  description:
    "Score a partial address record from 0 to 100 by completeness + plausibility. " +
    "Cheap pre-check before calling validate_address (which is more expensive). " +
    "Returns score, category (A/B/C/D), list of detected issues, and a " +
    "ready_for_datavask boolean so pipelines can gate downstream calls.",
  inputSchema: {
    type: "object",
    properties: {
      vejnavn: { type: "string" },
      husnr: { type: "string" },
      etage: { type: "string" },
      door: { type: "string" },
      postnr: { type: "string", pattern: "^\\d{4}$" },
      postnr_navn: { type: "string" },
      kommunekode: { type: "string", pattern: "^\\d{3,4}$" },
    },
    additionalProperties: false,
  },
  zod: qualityZ,
  handler: async (client, args) => client.qualityScore(args),
};

// ──────────────────────────────────────────────────────────────────────
// 8. property_data (ejendom hub — flagship)
// ──────────────────────────────────────────────────────────────────────
const ejendomZ = z.object({
  address_id: z.string().uuid().describe("Adgangsadresse UUID"),
});

const ejendom: ToolDef<typeof ejendomZ> = {
  name: "property_data",
  description:
    "The full Danish property record for an address in ONE call: properties " +
    "(BFE-number / samlet fast ejendom), the latest public valuation " +
    "(ejendomsværdi + grundværdi), zoning + local plan (Plandata), energy " +
    "label (EMO), terrain elevation (DHM), and BBR buildings. Use for " +
    "'what is this property worth?', 'what zone is it in?', 'energy rating?', " +
    "real-estate / insurance / due-diligence questions. Pass an adgangsadresse " +
    "UUID (from autocomplete_address / reverse_geocode).",
  inputSchema: {
    type: "object",
    required: ["address_id"],
    properties: { address_id: { type: "string", format: "uuid" } },
    additionalProperties: false,
  },
  zod: ejendomZ,
  handler: async (client, args) => client.ejendom(args.address_id),
};

// ──────────────────────────────────────────────────────────────────────
// 9. list_postnumre
// ──────────────────────────────────────────────────────────────────────
const postnrZ = z.object({
  query: z.string().optional().describe("Search by name (typo-tolerant)"),
  nr: z.string().regex(/^\d{4}$/).optional().describe("Exact 4-digit postcode"),
});

const postnumre: ToolDef<typeof postnrZ> = {
  name: "list_postnumre",
  description:
    "List Danish postal codes (postnumre). Filter by `nr` for an exact 4-digit " +
    "code or `query` to search by town name. Returns nr + navn (+ bbox/kommuner). " +
    "Use for 'what is postcode 8000?', 'postcodes in Aarhus', dropdowns.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      nr: { type: "string", pattern: "^\\d{4}$" },
    },
    additionalProperties: false,
  },
  zod: postnrZ,
  handler: async (client, args) => client.postnumre({ q: args.query, nr: args.nr }),
};

// ──────────────────────────────────────────────────────────────────────
// 10. list_kommuner
// ──────────────────────────────────────────────────────────────────────
const kommZ = z.object({
  query: z.string().optional().describe("Search by municipality name"),
  kode: z.string().regex(/^\d{3,4}$/).optional().describe("Exact kommunekode"),
});

const kommuner: ToolDef<typeof kommZ> = {
  name: "list_kommuner",
  description:
    "List Danish municipalities (kommuner). Filter by `kode` (e.g. 0101) or " +
    "`query` (name). Returns kode + navn (+ region). Use for 'which kommune is " +
    "X?', municipality pickers, and mapping kommunekode ↔ name.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      kode: { type: "string", pattern: "^\\d{3,4}$" },
    },
    additionalProperties: false,
  },
  zod: kommZ,
  handler: async (client, args) => client.kommuner({ q: args.query, kode: args.kode }),
};

// ──────────────────────────────────────────────────────────────────────
// 11. list_vejnavne
// ──────────────────────────────────────────────────────────────────────
const vejZ = z.object({
  query: z.string().min(1).describe("Street-name search text"),
});

const vejnavne: ToolDef<typeof vejZ> = {
  name: "list_vejnavne",
  description:
    "Search Danish street names (vejnavne) across the country. Returns matching " +
    "navn values. Use for street-name pickers or 'is there a street called …?'. " +
    "For a specific address use autocomplete_address instead.",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: { query: { type: "string", minLength: 1 } },
    additionalProperties: false,
  },
  zod: vejZ,
  handler: async (client, args) => client.vejnavne({ q: args.query }),
};

export const TOOLS = {
  autocomplete_address: autocomplete,
  lookup_address: lookup,
  validate_address: validate,
  reverse_geocode: reverse,
  enrich_with_dagi: dagi,
  property_data: ejendom,
  distance_between: distance,
  address_quality_score: quality,
  list_postnumre: postnumre,
  list_kommuner: kommuner,
  list_vejnavne: vejnavne,
} as const;

export type ToolName = keyof typeof TOOLS;
