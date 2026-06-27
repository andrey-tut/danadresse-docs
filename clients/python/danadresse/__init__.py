"""danadresse — Python SDK for danadresse.dk.

Drop-in DAWA replacement. 100% compatible.

Usage:
    from danadresse import Client
    client = Client(api_key="dawa_live_...")
    hits = client.autocomplete("Rådhuspladsen 1")
    print(hits[0]["tekst"])

By LynBro ApS · https://danadresse.dk
"""
from danadresse.client import AsyncClient, Client, DanadresseError

__version__ = "0.1.0"
__all__ = ["Client", "AsyncClient", "DanadresseError"]
