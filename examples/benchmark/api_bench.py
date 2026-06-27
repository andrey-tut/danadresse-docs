#!/usr/bin/env python3
"""API latency benchmark — danadresse.dk vs DAWA (api.dataforsyningen.dk).

Speed is the product. This measures real-world latency (TLS + network + app)
for the hot DAWA-compatible endpoints, computes p50/p95/p99, separates the
cold (first, uncached) call from warm (Redis hot-cache) calls, and runs the
SAME queries against the legacy DAWA so we can prove we're not slower.

Usage:
    python tests/benchmark/api_bench.py                       # vs DAWA, default host
    python tests/benchmark/api_bench.py --base https://danadresse.dk
    python tests/benchmark/api_bench.py --no-compare          # only our API
    python tests/benchmark/api_bench.py --n 30                # iterations/endpoint
    python tests/benchmark/api_bench.py --base http://127.0.0.1:8248 --no-tls-verify
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import time

import httpx

OUR_DEFAULT = "https://danadresse.dk"
DAWA = "https://api.dataforsyningen.dk"

# (label, path-with-query) — chosen to exercise every autocomplete phase + lookups.
CASES: list[tuple[str, str]] = [
    ("autocomplete street-prefix", "/autocomplete?q=strandvej&per_side=10"),
    ("autocomplete typo-fold",     "/autocomplete?q=kobenhavn&per_side=10"),
    ("autocomplete street→numbers","/autocomplete?q=Rådhuspladsen&per_side=10"),
    ("autocomplete full-address",  "/autocomplete?q=Slotsherrensvej 240&per_side=10"),
    ("adresser q-search",          "/adresser?q=strandvejen 100&per_side=10"),
    ("adgangsadresser q-search",   "/adgangsadresser?q=strandvejen 100&per_side=10"),
    ("datavask adresse",           "/datavask/adresser?betegnelse=Strandvejen 100, 2900 Hellerup"),
    ("reverse 4326",               "/adgangsadresser/reverse?x=12.5683&y=55.6761"),
    ("reverse 25832",              "/adgangsadresser/reverse?x=725448&y=6176113&srid=25832"),
    ("postnumre list",             "/postnumre?per_side=100"),
    ("postnummer single",          "/postnumre/2900"),
    ("kommuner list",              "/kommuner"),
]


def _pct(xs: list[float], p: float) -> float:
    if not xs:
        return float("nan")
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


async def _timed(client: httpx.AsyncClient, base: str, path: str) -> tuple[float, int, int]:
    t0 = time.perf_counter()
    try:
        r = await client.get(base + path)
        dt = (time.perf_counter() - t0) * 1000.0
        return dt, r.status_code, len(r.content)
    except Exception:
        return (time.perf_counter() - t0) * 1000.0, 0, 0


async def bench_endpoint(base: str, path: str, n: int, verify: bool) -> dict:
    # Fresh client per endpoint so a single slow/hung request can never poison
    # a shared HTTP/2 connection and cascade-fail the endpoints that follow.
    timeout = httpx.Timeout(30.0)
    headers = {"User-Agent": "danadresse-bench/1.0"}
    async with httpx.AsyncClient(http2=True, timeout=timeout, verify=verify,
                                 headers=headers, follow_redirects=True) as client:
        # cold call (separate, first hit — likely uncached)
        cold_ms, status, size = await _timed(client, base, path)
        # warm calls
        warm: list[float] = []
        last_status = status
        for _ in range(n):
            ms, st, sz = await _timed(client, base, path)
            warm.append(ms)
            last_status = st
    return {
        "cold_ms": cold_ms, "status": last_status, "bytes": size,
        "min": min(warm), "p50": _pct(warm, 0.50),
        "p95": _pct(warm, 0.95), "p99": _pct(warm, 0.99),
        "max": max(warm), "mean": statistics.mean(warm),
    }


async def run(base: str, compare: bool, n: int, verify: bool) -> None:
    print(f"\n{'='*92}")
    print(f"BENCHMARK  ours={base}  n={n} warm iters/endpoint"
          + (f"  vs DAWA={DAWA}" if compare else ""))
    print(f"{'='*92}")
    hdr = f"{'endpoint':<30} {'cold':>7} {'p50':>7} {'p95':>7} {'p99':>7} {'max':>7} {'st':>4}"
    if compare:
        hdr += f"  | {'DAWA p50':>9} {'DAWA p95':>9} {'Δp50':>8}"
    print(hdr)
    print("-" * len(hdr))

    our_p50s, dawa_p50s = [], []
    for label, path in CASES:
        ours = await bench_endpoint(base, path, n, verify)
        our_p50s.append(ours["p50"])
        line = (f"{label:<30} {ours['cold_ms']:>6.0f} {ours['p50']:>6.0f} "
                f"{ours['p95']:>6.0f} {ours['p99']:>6.0f} {ours['max']:>6.0f} "
                f"{ours['status']:>4}")
        if compare:
            d = await bench_endpoint(DAWA, path, n, True)
            dawa_p50s.append(d["p50"])
            delta = ours["p50"] - d["p50"]
            flag = "✓" if delta <= 0 else ("≈" if delta < 15 else "✗")
            line += (f"  | {d['p50']:>8.0f} {d['p95']:>8.0f} "
                     f"{delta:>+7.0f}{flag}")
        print(line)

    print("-" * len(hdr))
    print(f"{'AGGREGATE p50 (ms)':<30} {'':>7} {statistics.mean(our_p50s):>6.0f}", end="")
    if compare and dawa_p50s:
        print(f"  ours_mean={statistics.mean(our_p50s):.0f}  "
              f"dawa_mean={statistics.mean(dawa_p50s):.0f}  "
              f"faster_on={sum(1 for o,d in zip(our_p50s,dawa_p50s) if o<=d)}/{len(our_p50s)}")
    else:
        print()
    print("legend: cold=first uncached hit; ✓ we're faster, ≈ within 15ms, ✗ slower\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=OUR_DEFAULT)
    ap.add_argument("--no-compare", action="store_true")
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--no-tls-verify", action="store_true")
    a = ap.parse_args()
    asyncio.run(run(a.base, not a.no_compare, a.n, not a.no_tls_verify))


if __name__ == "__main__":
    main()
