<?php
if (!defined('ABSPATH')) exit;

/**
 * REST proxy для autocomplete — секрет API key лишається на сервері.
 */
class Danadresse_Rest {

    public function __construct() {
        add_action('rest_api_init', [$this, 'register']);
    }

    public function register() {
        register_rest_route('danadresse/v1', '/autocomplete', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [$this, 'autocomplete'],
            'args'     => [
                'q' => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);
    }

    public function autocomplete(WP_REST_Request $r) {
        $q    = $r->get_param('q');
        $key  = Danadresse_Settings::get('api_key');
        $base = Danadresse_Settings::get('api_base', 'https://api.danadresse.dk');
        if (!$key) return new WP_Error('no_key', 'API key not configured', ['status' => 503]);

        $url = add_query_arg(['q' => $q], "$base/autocomplete");
        $res = wp_remote_get($url, [
            'headers' => ['X-Api-Key' => $key],
            'timeout' => 5,
        ]);
        if (is_wp_error($res)) return new WP_Error('upstream', $res->get_error_message(), ['status' => 502]);

        $code = wp_remote_retrieve_response_code($res);
        $body = json_decode(wp_remote_retrieve_body($res), true);
        return new WP_REST_Response($body, $code);
    }
}
