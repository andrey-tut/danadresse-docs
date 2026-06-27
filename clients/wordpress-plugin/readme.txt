=== Danadresse for WooCommerce ===
Contributors: lynbro
Tags: danish address, autocomplete, woocommerce, dawa, checkout, denmark, dansk
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 0.1.0
Requires PHP: 7.4
License: MIT

Drop-in Danish address autocomplete + validation for WooCommerce checkout. Drop-in DAWA replacement.

== Description ==

Danadresse is a drop-in replacement for the official DAWA API (api.dataforsyningen.dk) which closes August 17, 2026.

* **Autocomplete on checkout** — typing "Rådhus" suggests "Rådhuspladsen 1, 1550 København V" — under 50ms.
* **Auto-fill** — selecting an address fills street, postcode, city.
* **Validation (datavask)** — option to validate addresses on submit and warn if uncertain.
* **Shortcode** `[danadresse_search]` for standalone use.
* **Free tier**: 1,000 calls/month, no credit card. [Get API key →](https://danadresse.dk/dashboard/keys)

Data source: Klimadatastyrelsen DAR (CC BY 4.0). 2.7M Danish addresses, updated every 15 minutes.

== Installation ==

1. Install and activate the plugin
2. Go to **Settings → Danadresse** and paste your API key (free at danadresse.dk)
3. Done — checkout autocomplete works automatically

== Frequently Asked Questions ==

= Is this related to the official DAWA? =
No — but it's 100% API-compatible. DAWA closes Aug 17, 2026; we use the same underlying data (DAR from Klimadatastyrelsen).

= Free tier limits? =
1,000 calls/month forever. For a typical small shop this is plenty.

= GDPR? =
EU servers (Germany). Addresses are public data (CC BY 4.0). API calls logged 30 days for billing only.

== Changelog ==

= 0.1.0 =
* First public release.
