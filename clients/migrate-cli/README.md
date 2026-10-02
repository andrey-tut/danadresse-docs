# @danadresse/migrate-cli

Auto-migrate your codebase from **DAWA** (`api.dataforsyningen.dk` / `dawa.aws.dk`) to **Danadresse**.

DAWA closes on **August 17, 2026**. Danadresse is a drop-in replacement —
this CLI scans your code, finds DAWA URLs, and rewrites them.

## Usage

```bash
# 1. Dry-run (preview changes)
npx @danadresse/migrate-cli

# 2. Apply changes
npx @danadresse/migrate-cli --write

# 3. Scan specific directory
npx @danadresse/migrate-cli --target src/

# 4. Get a reminder with your API key
npx @danadresse/migrate-cli --key dawa_live_xxxxx
```

## What it does

1. Recursively scans your project (`.js`, `.ts`, `.py`, `.php`, `.go`, `.java`, `.rb`, `.html`, `.json`, `.env`, etc.)
2. Finds occurrences of `dawa.aws.dk`, `api.dataforsyningen.dk` and the DAWA autocomplete widget on `cdn.dataforsyningen.dk/dawa/assets/dawa-autocomplete2/…`
3. Shows colored diff before applying
4. With `--write` — rewrites in place

## After migration

Add an `X-Api-Key` header to your requests. Get a free key (2,000 calls/month) at
[danadresse.dk/dashboard/keys](https://danadresse.dk/dashboard/keys).

```ts
const r = await fetch('https://api.danadresse.dk/autocomplete?q=Råd', {
    headers: { 'X-Api-Key': 'dawa_live_...' }
});
```

Using DAWA's JS widget (`dawa-autocomplete2.min.js`)? It is hosted on the same path —
append your key to the script URL and nothing else changes:

```html
<script src="https://api.danadresse.dk/js/autocomplete/dawa-autocomplete2.min.js?key=dawa_live_..."></script>
```

## License

MIT — see [LICENSE](./LICENSE).

By [LynBro ApS](https://lynbro.dk) · [danadresse.dk](https://danadresse.dk)
