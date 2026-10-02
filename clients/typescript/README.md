# @danadresse/js

**Drop-in DAWA replacement** — TypeScript/JavaScript SDK for Danish address API by LynBro ApS.

DAWA (`dawa.aws.dk`) closes **August 17, 2026**. This client is 100% compatible — change one line, add an API key, you're done.

## Install

```bash
npm install @danadresse/js
# or pnpm / yarn
```

## Quick start

```ts
import { danadresse } from '@danadresse/js';

const client = danadresse({
    apiKey: process.env.DANADRESSE_KEY,  // get one at app.danadresse.dk/keys
});

// Autocomplete (two-phase)
const hits = await client.autocomplete('Rådhuspladsen 1');
console.log(hits[0].tekst);
// → "Rådhuspladsen 1, 1550 København V"

// Full address lookup
const addr = await client.address('0a3f50af-2afe-32b8-e044-0003ba298018');

// Reverse geocoding (WGS84)
const nearest = await client.reverseGeocode(12.568, 55.676);

// Validation (datavask)
const result = await client.datavask({
    vejnavn: 'Rådhuspl',
    husnr: '1',
    postnr: '1550',
});
console.log(result.kategori);  // 'A' | 'B' | 'C'
```

## Migration from DAWA

```diff
- // DAWA
- const baseUrl = 'https://api.dataforsyningen.dk';
- const r = await fetch(`${baseUrl}/autocomplete?q=Råd`);
+ // Danadresse
+ const client = danadresse({ apiKey: 'dawa_live_...' });
+ const r = await client.autocomplete('Råd');
```

All field names, IDs (UUIDv4), and response shapes are **identical** to DAWA.

## Pricing

| Tier | Limit | Price |
|------|-------|-------|
| Free | 2 000 API + 250 MCP / month | 0 DKK |
| Basic | 60 000 API + 5 000 MCP / month | 89 DKK/mo (71 DKK/mo billed yearly) |
| Pro | 350 000 API + 25 000 MCP / month | 279 DKK/mo (223 DKK/mo billed yearly) |
| Enterprise | 2.5M API + 200 000 MCP / month | from 499 DKK/mo |

Prices ex VAT. Overage: 0.001 DKK per extra API call.

Sign up: <https://danadresse.dk>

## License

MIT — see [LICENSE](./LICENSE).
