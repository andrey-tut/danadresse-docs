<?php
/**
 * Danadresse API — PHP example (no dependencies).
 *
 * Drop-in DAWA replacement. Base URL: https://api.danadresse.dk
 * Auth: X-Api-Key header (free tier works without a key, lower IP rate limit).
 *
 *   DANADRESSE_API_KEY=dawa_live_xxx php php_example.php
 */
$BASE   = "https://api.danadresse.dk";
$apiKey = getenv("DANADRESSE_API_KEY") ?: null;

function da_get(string $path, array $params = []): mixed {
    global $BASE, $apiKey;
    $url = $BASE . $path . "?" . http_build_query($params);
    $headers = ["Accept: application/json"];
    if ($apiKey) { $headers[] = "X-Api-Key: " . $apiKey; }
    $ctx = stream_context_create(["http" => ["header" => implode("\r\n", $headers), "timeout" => 15]]);
    return json_decode(file_get_contents($url, false, $ctx), true);
}

// 1) Autocomplete (typeahead) — same contract as DAWA /autocomplete
$hits = da_get("/autocomplete", ["q" => "rådhuspladsen 1 københavn"]);
echo "autocomplete: " . ($hits[0]["tekst"] ?? "—") . "\n";

// 2) Datavask — clean a messy address to an authoritative DAR address
$vask = da_get("/datavask/adresser", ["betegnelse" => "rådhuspladsen 1 1550 københavn"]);
echo "datavask category: " . ($vask["kategori"] ?? "?") . "\n";

// 3) Reverse geocoding — coordinates → nearest access address (WGS84)
$rev = da_get("/adgangsadresser/reverse", ["x" => 12.5683, "y" => 55.6761]);
echo "reverse: {$rev['vejnavn']} {$rev['husnr']}, {$rev['postnr']}\n";

// Migration from DAWA: change the base URL to api.danadresse.dk and add the
// X-Api-Key header. Endpoints + JSON shapes are identical.
