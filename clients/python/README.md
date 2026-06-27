# danadresse

**Drop-in DAWA replacement** — Python SDK for Danish address API by LynBro ApS.

[DAWA](https://dawa.aws.dk) closes **17 August 2026**. This SDK is 100% compatible — change one line, add an API key, you're done.

## Install

```bash
pip install danadresse
```

## Quick start

```python
from danadresse import Client

client = Client(api_key="dawa_live_...")  # get one at app.danadresse.dk/keys

# Autocomplete (two-phase)
hits = client.autocomplete("Rådhuspladsen 1")
print(hits[0]["tekst"])
# → "Rådhuspladsen 1, 1550 København V"

# Full address lookup by ID
addr = client.address("0a3f50af-2afe-32b8-e044-0003ba298018")

# Reverse geocoding (WGS84)
nearest = client.reverse_geocode(12.568, 55.676)

# Validation (datavask)
result = client.datavask(vejnavn="Rådhuspl", husnr="1", postnr="1550")
print(result["kategori"])  # 'A' | 'B' | 'C'
```

## Async

```python
import asyncio
from danadresse import AsyncClient

async def main():
    async with AsyncClient(api_key="dawa_live_...") as client:
        hits = await client.autocomplete("Råd")
        print(hits[0]["tekst"])

asyncio.run(main())
```

## Migration from DAWA

```python
# DAWA way:
import httpx
r = httpx.get("https://api.dataforsyningen.dk/autocomplete", params={"q": "Råd"})

# Danadresse way:
from danadresse import Client
hits = Client(api_key="dawa_live_...").autocomplete("Råd")
```

All field names, IDs (UUIDv4) and response shapes are **identical** to DAWA.

## License

MIT — see [LICENSE](./LICENSE).
