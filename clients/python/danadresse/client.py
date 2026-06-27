"""Sync + Async Python SDK for danadresse.dk."""
from __future__ import annotations

import json
from typing import Any, Optional

import httpx


class DanadresseError(Exception):
    def __init__(self, status: int, detail: Any, url: str) -> None:
        super().__init__(f"Danadresse {status}: {detail}")
        self.status = status
        self.detail = detail
        self.url = url


_DEFAULT_BASE = "https://api.danadresse.dk"
_DEFAULT_UA = "danadresse-python/0.1"


class _Mixin:
    """Common URL building + body construction (shared by sync/async clients)."""

    base_url: str
    api_key: Optional[str]

    def _build_url(self, path: str) -> str:
        return self.base_url + path

    def _headers(self, has_body: bool = False) -> dict[str, str]:
        h = {"Accept": "application/json", "User-Agent": _DEFAULT_UA}
        if self.api_key:
            h["X-Api-Key"] = self.api_key
        if has_body:
            h["Content-Type"] = "application/json"
        return h

    def _params_for_autocomplete(self, query: str, struktur: Optional[str], srid: Optional[int],
                                  fuzzy: Optional[bool], adgangsadresser_only: bool,
                                  params: Optional[dict]) -> dict[str, Any]:
        p: dict[str, Any] = {"q": query}
        if struktur:
            p["struktur"] = struktur
        if srid:
            p["srid"] = srid
        if fuzzy is not None:
            p["fuzzy"] = "true" if fuzzy else "false"
        if adgangsadresser_only:
            p["adgangsadresserOnly"] = "true"
        if params:
            p["params"] = json.dumps(params)
        return p


class Client(_Mixin):
    """Synchronous client. Wraps httpx.Client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = _DEFAULT_BASE,
        timeout: float = 15.0,
        client: Optional[httpx.Client] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(timeout=timeout)
        self._owns_client = client is None

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *exc: Any) -> None:
        if self._owns_client:
            self._client.close()

    # ----- public methods (mirror DAWA endpoints) -----

    def autocomplete(self, query: str, *, struktur: Optional[str] = None,
                     srid: Optional[int] = None, fuzzy: Optional[bool] = None,
                     adgangsadresser_only: bool = False,
                     params: Optional[dict] = None) -> list[dict]:
        return self._get("/autocomplete", self._params_for_autocomplete(
            query, struktur, srid, fuzzy, adgangsadresser_only, params,
        ))

    def addresses(self, **query: Any) -> list[dict]:
        return self._get("/adresser", query)

    def address(self, id_: str) -> dict:
        return self._get(f"/adresser/{id_}", {})

    def access_addresses(self, **query: Any) -> list[dict]:
        return self._get("/adgangsadresser", query)

    def access_address(self, id_: str) -> dict:
        return self._get(f"/adgangsadresser/{id_}", {})

    def reverse_geocode(self, x: float, y: float, srid: int = 4326) -> dict:
        return self._get("/adgangsadresser/reverse", {"x": x, "y": y, "srid": srid})

    def postnumre(self, **query: Any) -> list[dict]:
        return self._get("/postnumre", query)

    def kommuner(self, **query: Any) -> list[dict]:
        return self._get("/kommuner", query)

    def vejnavne(self, **query: Any) -> list[dict]:
        return self._get("/vejnavne", query)

    def datavask(self, *, vejnavn: Optional[str] = None, husnr: Optional[str] = None,
                 etage: Optional[str] = None, doer: Optional[str] = None,
                 postnr: Optional[str] = None,
                 type_: str = "adgangsadresser") -> dict:
        body = {k: v for k, v in {
            "vejnavn": vejnavn, "husnr": husnr, "etage": etage,
            "dør": doer, "postnr": postnr,
        }.items() if v is not None}
        return self._post(f"/datavask/{type_}", body)

    # ----- low-level -----

    def _get(self, path: str, query: dict) -> Any:
        url = self._build_url(path)
        r = self._client.get(url, params={k: v for k, v in query.items() if v is not None},
                              headers=self._headers())
        return self._handle(r)

    def _post(self, path: str, body: dict) -> Any:
        url = self._build_url(path)
        r = self._client.post(url, json=body, headers=self._headers(has_body=True))
        return self._handle(r)

    def _handle(self, r: httpx.Response) -> Any:
        if r.is_error:
            detail: Any
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise DanadresseError(r.status_code, detail, str(r.url))
        if not r.content:
            return None
        return r.json()


class AsyncClient(_Mixin):
    """Asynchronous client. Wraps httpx.AsyncClient."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = _DEFAULT_BASE,
        timeout: float = 15.0,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._owns_client = client is None

    async def __aenter__(self) -> "AsyncClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def autocomplete(self, query: str, *, struktur: Optional[str] = None,
                           srid: Optional[int] = None, fuzzy: Optional[bool] = None,
                           adgangsadresser_only: bool = False,
                           params: Optional[dict] = None) -> list[dict]:
        return await self._get("/autocomplete", self._params_for_autocomplete(
            query, struktur, srid, fuzzy, adgangsadresser_only, params,
        ))

    async def addresses(self, **query: Any) -> list[dict]:
        return await self._get("/adresser", query)

    async def address(self, id_: str) -> dict:
        return await self._get(f"/adresser/{id_}", {})

    async def access_addresses(self, **query: Any) -> list[dict]:
        return await self._get("/adgangsadresser", query)

    async def access_address(self, id_: str) -> dict:
        return await self._get(f"/adgangsadresser/{id_}", {})

    async def reverse_geocode(self, x: float, y: float, srid: int = 4326) -> dict:
        return await self._get("/adgangsadresser/reverse", {"x": x, "y": y, "srid": srid})

    async def postnumre(self, **query: Any) -> list[dict]:
        return await self._get("/postnumre", query)

    async def kommuner(self, **query: Any) -> list[dict]:
        return await self._get("/kommuner", query)

    async def vejnavne(self, **query: Any) -> list[dict]:
        return await self._get("/vejnavne", query)

    async def datavask(self, *, vejnavn: Optional[str] = None, husnr: Optional[str] = None,
                       etage: Optional[str] = None, doer: Optional[str] = None,
                       postnr: Optional[str] = None,
                       type_: str = "adgangsadresser") -> dict:
        body = {k: v for k, v in {
            "vejnavn": vejnavn, "husnr": husnr, "etage": etage,
            "dør": doer, "postnr": postnr,
        }.items() if v is not None}
        return await self._post(f"/datavask/{type_}", body)

    async def _get(self, path: str, query: dict) -> Any:
        url = self._build_url(path)
        r = await self._client.get(url, params={k: v for k, v in query.items() if v is not None},
                                    headers=self._headers())
        return self._handle(r)

    async def _post(self, path: str, body: dict) -> Any:
        url = self._build_url(path)
        r = await self._client.post(url, json=body, headers=self._headers(has_body=True))
        return self._handle(r)

    def _handle(self, r: httpx.Response) -> Any:
        if r.is_error:
            detail: Any
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise DanadresseError(r.status_code, detail, str(r.url))
        if not r.content:
            return None
        return r.json()
