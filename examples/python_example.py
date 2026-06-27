#!/usr/bin/env python3
"""Danadresse API — Python example (stdlib only, no dependencies).

Drop-in DAWA replacement. For a typed client see the `danadresse` package in
clients/python (pip install danadresse) or the npm @danadresse/client.

    python python_example.py
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

BASE = "https://api.danadresse.dk"
API_KEY = os.environ.get("DANADRESSE_API_KEY")  # optional; free tier works without


def get(path: str, **params) -> object:
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url)
    if API_KEY:
        req.add_header("X-Api-Key", API_KEY)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


if __name__ == "__main__":
    # 1) Autocomplete
    hits = get("/autocomplete", q="rådhuspladsen 1 københavn")
    print("autocomplete:", hits[0]["tekst"] if hits else "—")

    # 2) Datavask (address cleansing → authoritative DAR address)
    vask = get("/datavask/adresser", betegnelse="rådhuspladsen 1 1550 københavn")
    print("datavask category:", vask.get("kategori"))

    # 3) Reverse geocoding (coordinates → nearest access address)
    rev = get("/adgangsadresser/reverse", x=12.5683, y=55.6761)
    print("reverse:", rev.get("vejnavn"), rev.get("husnr"), rev.get("postnr"))

    # Migration from DAWA: change BASE from api.dataforsyningen.dk to
    # api.danadresse.dk and set DANADRESSE_API_KEY. Nothing else changes.
