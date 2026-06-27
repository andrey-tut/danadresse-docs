/**
 * Danadresse API — JavaScript example (Node 18+ / browser, native fetch).
 *
 * Drop-in DAWA replacement. For a typed client: npm i @danadresse/client.
 *
 *   DANADRESSE_API_KEY=dawa_live_xxx node javascript_example.js
 */
const BASE = "https://api.danadresse.dk";
const API_KEY = process.env.DANADRESSE_API_KEY; // optional; free tier works without

async function get(path, params = {}) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const headers = API_KEY ? { "X-Api-Key": API_KEY } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

(async () => {
  // 1) Autocomplete (typeahead) — same shape as DAWA /autocomplete
  const hits = await get("/autocomplete", { q: "rådhuspladsen 1 københavn" });
  console.log("autocomplete:", hits[0]?.tekst ?? "—");

  // 2) Datavask — clean a messy address to an authoritative DAR address
  const vask = await get("/datavask/adresser", {
    betegnelse: "rådhuspladsen 1 1550 københavn",
  });
  console.log("datavask category:", vask.kategori);

  // 3) Reverse geocoding — coordinates → nearest access address (WGS84)
  const rev = await get("/adgangsadresser/reverse", { x: 12.5683, y: 55.6761 });
  console.log("reverse:", rev.vejnavn, rev.husnr, rev.postnr);

  // Migration from DAWA: swap api.dataforsyningen.dk → api.danadresse.dk and
  // add the X-Api-Key header. Endpoints + response shapes are 1:1.
})();
