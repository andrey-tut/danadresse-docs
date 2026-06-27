/**
 * Thin HTTP client for api.danadresse.dk.
 *
 * Every call returns the raw JSON the server emits so the AI sees the same
 * field names humans see in /docs. It captures the server's X-RateLimit-*
 * headers (exposed via getRateLimit()) and retries transient failures
 * (429 / 5xx / network / timeout) with bounded backoff.
 *
 * Authentication: optional X-Api-Key. The free tier is per-IP (1 000 calls/
 * MONTH); passing DANADRESSE_API_KEY raises that to whatever the key's plan
 * allows (enterprise = unlimited). The server enforces the same limits whether
 * you call it directly or through this MCP server.
 */

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;

export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly hint?: string;
  public readonly body?: unknown;

  constructor(opts: {
    status: number;
    message: string;
    code?: string;
    hint?: string;
    body?: unknown;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.hint = opts.hint;
    this.body = opts.body;
  }
}

export interface ClientOpts {
  baseUrl: string;
  apiKey?: string;
  userAgent: string;
  timeoutMs: number;
}

export interface AutocompleteHit {
  tekst: string;
  forslagstekst?: string;
  type?: string;
  caretpos?: number;
  data: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DanadresseClient {
  private _rate?: RateLimit;

  constructor(private readonly opts: ClientOpts) {}

  /** Most recent rate-limit snapshot from the API (undefined until first call). */
  getRateLimit(): RateLimit | undefined {
    return this._rate;
  }

  private _captureRate(headers: Headers): void {
    const lim = headers.get("x-ratelimit-limit");
    if (lim === null) return;
    this._rate = {
      limit: Number(lim),
      remaining: Number(headers.get("x-ratelimit-remaining") ?? 0),
      reset: Number(headers.get("x-ratelimit-reset") ?? 0),
    };
  }

  private _toError(status: number, parsed: unknown, method: string, pathname: string): ApiError {
    const p = parsed as
      | {
          detail?: { error?: { code?: string; message?: string; hint?: string } };
          title?: string;
          type?: string;
          detail_?: unknown;
        }
      | undefined;
    const v1 = p?.detail?.error;
    // Handle both envelope shapes: v1 {detail:{error:{code,message,hint}}} and
    // DAWA-compat RFC7807 {type,title,details}.
    const message =
      v1?.message ??
      p?.title ??
      (typeof (parsed as { detail?: unknown })?.detail === "string"
        ? (parsed as { detail: string }).detail
        : undefined) ??
      `${method} ${pathname} → HTTP ${status}`;
    let hint = v1?.hint;
    if (status === 429 && !hint) {
      hint = "Rate limit reached — slow down, or add/upgrade your DANADRESSE_API_KEY.";
    }
    return new ApiError({ status, message, code: v1?.code ?? p?.type, hint, body: parsed });
  }

  private _retryDelay(attempt: number, headers?: Headers): number {
    if (headers) {
      const ra = headers.get("retry-after");
      if (ra && /^\d+$/.test(ra)) return Math.min(Number(ra) * 1000, 5000);
    }
    // exponential backoff with jitter, capped at 3s
    return Math.min(300 * 2 ** attempt + Math.floor(Math.random() * 200), 3000);
  }

  private async fetchJson<T>(
    method: "GET" | "POST",
    path: string,
    init: { query?: Record<string, string | number | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(path, this.opts.baseUrl);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.opts.userAgent,
    };
    if (this.opts.apiKey) headers["X-Api-Key"] = this.opts.apiKey;
    if (init.body) headers["Content-Type"] = "application/json";

    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: controller.signal,
        });
        this._captureRate(res.headers);

        const text = await res.text();
        let parsed: unknown = undefined;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
        }

        if (res.ok) return parsed as T;

        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          await sleep(this._retryDelay(attempt, res.headers));
          attempt++;
          continue;
        }
        throw this._toError(res.status, parsed, method, url.pathname);
      } catch (err) {
        if (err instanceof ApiError) throw err; // final, non-retryable
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (attempt < MAX_RETRIES) {
          await sleep(this._retryDelay(attempt));
          attempt++;
          continue;
        }
        if (isAbort) {
          throw new ApiError({
            status: 504,
            message: `Request timed out after ${this.opts.timeoutMs} ms`,
            code: "timeout",
          });
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new ApiError({
          status: 0,
          message: `Network error calling ${method} ${path}: ${msg}`,
          code: "network",
        });
      } finally {
        clearTimeout(timer);
      }
    }
  }

  /** GET /autocomplete — typo-tolerant address search. */
  autocomplete(opts: {
    q: string;
    fuzzy?: boolean;
    type?: "vejnavn" | "vejnavn+husnr" | "adgangsadresse" | "adresse";
    perSide?: number;
  }): Promise<AutocompleteHit[]> {
    return this.fetchJson<AutocompleteHit[]>("GET", "/autocomplete", {
      query: {
        q: opts.q,
        fuzzy: opts.fuzzy !== false ? "true" : "false",
        type: opts.type,
        per_side: opts.perSide ?? 10,
      },
    });
  }

  /** GET /adresser/{id} — full address by UUID. */
  lookupAddress(id: string): Promise<Record<string, unknown>> {
    return this.fetchJson<Record<string, unknown>>("GET", `/adresser/${encodeURIComponent(id)}`);
  }

  /** GET /adgangsadresser/{id} — entry-level address by UUID. */
  lookupAdgangsadresse(id: string): Promise<Record<string, unknown>> {
    return this.fetchJson<Record<string, unknown>>(
      "GET",
      `/adgangsadresser/${encodeURIComponent(id)}`
    );
  }

  /** POST /datavask/adresser — clean & score a partial/dirty address. */
  validateAddress(input: {
    vejnavn?: string;
    husnr?: string;
    etage?: string;
    door?: string;
    postnr?: string;
    supplerendebynavn?: string;
  }): Promise<{ kategori: "A" | "B" | "C"; resultater: Array<Record<string, unknown>> }> {
    return this.fetchJson("POST", "/datavask/adresser", {
      body: {
        vejnavn: input.vejnavn,
        husnr: input.husnr,
        etage: input.etage,
        dør: input.door,
        postnr: input.postnr,
        supplerendebynavn: input.supplerendebynavn,
      },
    });
  }

  /** GET /adgangsadresser/reverse — coordinate → nearest address. */
  reverseGeocode(opts: { x: number; y: number; srid?: 4326 | 25832 }): Promise<Record<string, unknown>> {
    return this.fetchJson("GET", "/adgangsadresser/reverse", {
      query: { x: opts.x, y: opts.y, srid: opts.srid ?? 4326 },
    });
  }

  /** GET /api/v1/enrich/adresser/{id}/dagi — administrative areas. */
  enrichDagi(id: string): Promise<Record<string, unknown>> {
    return this.fetchJson(
      "GET",
      `/api/v1/enrich/adresser/${encodeURIComponent(id)}/dagi`
    );
  }

  /** GET /api/v1/enrich/adresser/{id}/ejendom — full property-data hub. */
  ejendom(id: string): Promise<Record<string, unknown>> {
    return this.fetchJson(
      "GET",
      `/api/v1/enrich/adresser/${encodeURIComponent(id)}/ejendom`
    );
  }

  /** GET /postnumre — postal codes (optional q / nr filter). */
  postnumre(opts: { q?: string; nr?: string } = {}): Promise<Array<Record<string, unknown>>> {
    return this.fetchJson("GET", "/postnumre", { query: { q: opts.q, nr: opts.nr } });
  }

  /** GET /kommuner — municipalities (optional q / kode filter). */
  kommuner(opts: { q?: string; kode?: string } = {}): Promise<Array<Record<string, unknown>>> {
    return this.fetchJson("GET", "/kommuner", { query: { q: opts.q, kode: opts.kode } });
  }

  /** GET /vejnavne — street names (optional q filter). */
  vejnavne(opts: { q?: string } = {}): Promise<Array<Record<string, unknown>>> {
    return this.fetchJson("GET", "/vejnavne", { query: { q: opts.q } });
  }

  /** GET /api/v1/enrich/distance — haversine km + bearing between two UUIDs. */
  distance(from: string, to: string): Promise<Record<string, unknown>> {
    return this.fetchJson("GET", "/api/v1/enrich/distance", {
      query: { from, to },
    });
  }

  /** POST /api/v1/enrich/quality/score — 0–100 confidence for partial input. */
  qualityScore(input: {
    vejnavn?: string;
    husnr?: string;
    etage?: string;
    door?: string;
    postnr?: string;
    postnr_navn?: string;
    kommunekode?: string;
  }): Promise<Record<string, unknown>> {
    return this.fetchJson("POST", "/api/v1/enrich/quality/score", { body: input });
  }

  /** GET /api/v1/stats — live address counts (used as a health probe). */
  stats(): Promise<Record<string, unknown>> {
    return this.fetchJson("GET", "/api/v1/stats");
  }
}
