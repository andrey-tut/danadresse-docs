#!/usr/bin/env bash
# Danadresse API — curl examples
# Drop-in DAWA replacement. Base URL: https://api.danadresse.dk
# Auth: add  -H "X-Api-Key: dawa_live_..."  (free tier works without a key at a
# lower per-IP rate limit). Get a key at https://danadresse.dk.
set -euo pipefail

BASE="https://api.danadresse.dk"
# KEY="dawa_live_xxx"; AUTH=(-H "X-Api-Key: $KEY")
AUTH=()

echo "# 1) Autocomplete (typeahead) — same contract as DAWA /autocomplete"
curl -s "${AUTH[@]}" "$BASE/autocomplete?q=rådhuspladsen+1+københavn" | head -c 600; echo

echo "# 2) Address search (structured JSON, same as DAWA /adresser)"
curl -s "${AUTH[@]}" "$BASE/adresser?q=rådhuspladsen+1&per_side=1"

echo "# 3) Datavask — clean a messy address to an authoritative DAR address"
curl -s "${AUTH[@]}" "$BASE/datavask/adresser?betegnelse=rådhuspladsen+1+1550+københavn"

echo "# 4) Reverse geocoding — coordinates → nearest access address (WGS84)"
curl -s "${AUTH[@]}" "$BASE/adgangsadresser/reverse?x=12.5683&y=55.6761"

echo "# 5) Postal codes / municipalities (administrative data)"
curl -s "${AUTH[@]}" "$BASE/postnumre?nr=1550"
curl -s "${AUTH[@]}" "$BASE/kommuner?navn=København"

echo "# 6) Migration from DAWA: only the base URL + the X-Api-Key header change."
echo "#   before: https://api.dataforsyningen.dk/autocomplete?q=..."
echo "#   after : https://api.danadresse.dk/autocomplete?q=...   (+ X-Api-Key)"
