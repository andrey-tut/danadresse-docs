/**
 * @danadresse/js — TypeScript SDK for danadresse.dk
 *
 * Drop-in replacement for DAWA (Danish Address Web API). 100% compatible.
 * Just change baseUrl and add X-Api-Key header.
 *
 * @example
 * ```ts
 * import { danadresse } from '@danadresse/js';
 * const client = danadresse({ apiKey: 'dawa_live_...' });
 * const hits = await client.autocomplete('Rådhuspladsen 1');
 * console.log(hits[0].tekst);
 * ```
 */

export interface ClientOptions {
    /** Your danadresse.dk API key. Get one at https://app.danadresse.dk/keys */
    apiKey?: string;
    /** Override base URL. Default: https://api.danadresse.dk */
    baseUrl?: string;
    /** Request timeout in ms. Default: 15000 */
    timeoutMs?: number;
    /** Custom fetch implementation (e.g., for Node 16 or testing) */
    fetch?: typeof fetch;
}

export interface AutocompleteSuggestion {
    type: 'vejnavn' | 'adresse' | 'adgangsadresse';
    tekst: string;
    forslagstekst: string;
    caretpos: number;
    data: Record<string, unknown>;
}

export interface Address {
    id: string;
    status: number;
    vejnavn?: string;
    husnr?: string;
    etage?: string | null;
    dør?: string | null;
    postnr?: string;
    postnrnavn?: string;
    kommunekode?: string;
    kommunenavn?: string;
    betegnelse?: string;
    [k: string]: unknown;
}

export interface AccessAddress {
    id: string;
    status: number;
    husnr?: string;
    postnummer?: { nr: string; navn: string };
    kommune?: { kode: string; navn: string };
    adgangspunkt?: { koordinater: [number, number] | null };
    betegnelse?: string;
    [k: string]: unknown;
}

export interface Postnummer {
    href: string;
    nr: string;
    navn: string;
    stormodtager: boolean;
}

export interface DatavaskInput {
    vejnavn?: string;
    husnr?: string;
    etage?: string;
    dør?: string;
    postnr?: string;
}

export interface DatavaskResult {
    kategori: 'A' | 'B' | 'C';
    resultater: Array<{
        vaskeresultat: { kategori: string; score: number };
        adresse: Record<string, unknown>;
    }>;
}

export class DanadresseClient {
    private apiKey?: string;
    private baseUrl: string;
    private timeoutMs: number;
    private fetchImpl: typeof fetch;

    constructor(opts: ClientOptions = {}) {
        this.apiKey = opts.apiKey;
        this.baseUrl = (opts.baseUrl ?? 'https://api.danadresse.dk').replace(/\/+$/, '');
        this.timeoutMs = opts.timeoutMs ?? 15000;
        this.fetchImpl = opts.fetch ?? globalThis.fetch;
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('fetch is not available. Pass `fetch` option (node-fetch, undici).');
        }
    }

    /** Two-phase address autocomplete. Returns array of suggestions. */
    autocomplete(query: string, opts?: {
        struktur?: 'mini' | 'full';
        srid?: 4326 | 25832;
        fuzzy?: boolean;
        adgangsadresserOnly?: boolean;
        params?: Record<string, string | number>;
    }): Promise<AutocompleteSuggestion[]> {
        return this.get<AutocompleteSuggestion[]>('/autocomplete', {
            q: query,
            ...(opts?.struktur && { struktur: opts.struktur }),
            ...(opts?.srid && { srid: opts.srid }),
            ...(opts?.fuzzy !== undefined && { fuzzy: opts.fuzzy }),
            ...(opts?.adgangsadresserOnly && { adgangsadresserOnly: true }),
            ...(opts?.params && { params: JSON.stringify(opts.params) }),
        });
    }

    /** List addresses matching criteria. */
    addresses(query: Record<string, string | number | undefined> = {}): Promise<Address[]> {
        return this.get<Address[]>('/adresser', query);
    }

    /** Look up single address by ID (UUIDv4). */
    address(id: string): Promise<Address> {
        return this.get<Address>(`/adresser/${encodeURIComponent(id)}`);
    }

    /** List access addresses (one per entrance). */
    accessAddresses(query: Record<string, string | number | undefined> = {}): Promise<AccessAddress[]> {
        return this.get<AccessAddress[]>('/adgangsadresser', query);
    }

    accessAddress(id: string): Promise<AccessAddress> {
        return this.get<AccessAddress>(`/adgangsadresser/${encodeURIComponent(id)}`);
    }

    /** Reverse geocoding: coordinates → nearest access address. */
    reverseGeocode(x: number, y: number, srid: 4326 | 25832 = 4326): Promise<AccessAddress> {
        return this.get<AccessAddress>('/adgangsadresser/reverse', { x, y, srid });
    }

    /** Postal codes. */
    postnumre(query: Record<string, string | number | undefined> = {}): Promise<Postnummer[]> {
        return this.get<Postnummer[]>('/postnumre', query);
    }

    /** Address validation/cleaning. Returns A/B/C category + scored matches. */
    datavask(input: DatavaskInput, type: 'adresser' | 'adgangsadresser' = 'adgangsadresser'): Promise<DatavaskResult> {
        return this.post<DatavaskResult>(`/datavask/${type}`, input);
    }

    // ---- low-level ----

    async get<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
        const url = new URL(this.baseUrl + path);
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
        }
        return this.request<T>('GET', url.toString());
    }

    async post<T>(path: string, body: unknown): Promise<T> {
        return this.request<T>('POST', this.baseUrl + path, JSON.stringify(body));
    }

    private async request<T>(method: string, url: string, body?: string): Promise<T> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'User-Agent': '@danadresse/js',
        };
        if (this.apiKey) headers['X-Api-Key'] = this.apiKey;
        if (body) headers['Content-Type'] = 'application/json';

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
            const r = await this.fetchImpl(url, { method, headers, body, signal: ctrl.signal });
            const text = await r.text();
            if (!r.ok) {
                let detail: unknown = text;
                try { detail = JSON.parse(text); } catch {}
                throw new DanadresseError(r.status, detail, url);
            }
            return text ? (JSON.parse(text) as T) : (undefined as T);
        } finally {
            clearTimeout(t);
        }
    }
}

export class DanadresseError extends Error {
    status: number;
    detail: unknown;
    url: string;
    constructor(status: number, detail: unknown, url: string) {
        super(`Danadresse ${status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        this.status = status;
        this.detail = detail;
        this.url = url;
        this.name = 'DanadresseError';
    }
}

/** Factory helper: `const c = danadresse({apiKey: '...'})` */
export function danadresse(opts: ClientOptions = {}): DanadresseClient {
    return new DanadresseClient(opts);
}

export default DanadresseClient;
