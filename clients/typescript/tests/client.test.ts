import { describe, it, expect } from 'vitest';
import { DanadresseClient, danadresse } from '../src/index.js';

describe('DanadresseClient', () => {
    it('factory returns instance', () => {
        const c = danadresse({ apiKey: 'test' });
        expect(c).toBeInstanceOf(DanadresseClient);
    });

    it('throws when fetch is not available', () => {
        expect(() => new DanadresseClient({ fetch: undefined as never })).toThrow(/fetch/);
    });

    it('builds correct URL with query params', async () => {
        let capturedUrl = '';
        const fakeFetch = async (url: string) => {
            capturedUrl = url;
            return new Response('[]', { status: 200 });
        };
        const c = new DanadresseClient({ fetch: fakeFetch as never, baseUrl: 'https://api.danadresse.dk' });
        await c.autocomplete('Råd', { struktur: 'full', srid: 4326 });
        expect(capturedUrl).toContain('q=R%C3%A5d');
        expect(capturedUrl).toContain('struktur=full');
        expect(capturedUrl).toContain('srid=4326');
    });

    it('sends X-Api-Key header', async () => {
        let captured: Headers | undefined;
        const fakeFetch = async (_: string, init: RequestInit) => {
            captured = new Headers(init.headers as HeadersInit);
            return new Response('[]', { status: 200 });
        };
        const c = new DanadresseClient({ fetch: fakeFetch as never, apiKey: 'dawa_live_abc' });
        await c.postnumre();
        expect(captured?.get('x-api-key')).toBe('dawa_live_abc');
    });
});
