"""Test Python SDK через respx (mocked httpx)."""
import pytest
import respx
import httpx

from danadresse import Client, AsyncClient, DanadresseError


@respx.mock
def test_autocomplete_sync():
    respx.get("https://api.danadresse.dk/autocomplete").mock(
        return_value=httpx.Response(200, json=[{"type": "vejnavn", "tekst": "Råd"}]),
    )
    c = Client(api_key="dawa_test_abc")
    hits = c.autocomplete("Råd")
    assert hits[0]["type"] == "vejnavn"


@respx.mock
def test_api_key_header():
    route = respx.get("https://api.danadresse.dk/postnumre").mock(
        return_value=httpx.Response(200, json=[]),
    )
    c = Client(api_key="dawa_live_xyz")
    c.postnumre()
    assert route.called
    assert route.calls[0].request.headers["X-Api-Key"] == "dawa_live_xyz"


@respx.mock
def test_error_raises():
    respx.get("https://api.danadresse.dk/adresser/bad").mock(
        return_value=httpx.Response(404, json={"error": {"code": "not_found"}}),
    )
    c = Client()
    with pytest.raises(DanadresseError) as exc:
        c.address("bad")
    assert exc.value.status == 404


@pytest.mark.asyncio
@respx.mock
async def test_async_autocomplete():
    respx.get("https://api.danadresse.dk/autocomplete").mock(
        return_value=httpx.Response(200, json=[{"tekst": "Foo"}]),
    )
    async with AsyncClient() as c:
        hits = await c.autocomplete("F")
    assert hits[0]["tekst"] == "Foo"
