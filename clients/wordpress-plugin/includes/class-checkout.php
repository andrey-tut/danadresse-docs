<?php
if (!defined('ABSPATH')) exit;

class Danadresse_Checkout {

    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue']);
        add_action('woocommerce_review_order_before_payment', [$this, 'inject_marker']);
        add_shortcode('danadresse_search', [$this, 'shortcode']);
        // Validation на submit checkout
        add_action('woocommerce_checkout_process', [$this, 'validate_address']);
    }

    public function enqueue() {
        if (!Danadresse_Settings::get('autocomplete')) return;
        if (!is_checkout() && !is_account_page()) return;
        wp_enqueue_script(
            'danadresse-checkout',
            DANADRESSE_URL . 'assets/js/checkout.js',
            [],
            DANADRESSE_VERSION,
            true
        );
        wp_localize_script('danadresse-checkout', 'DANADRESSE', [
            'rest'  => esc_url_raw(rest_url('danadresse/v1/')),
            'nonce' => wp_create_nonce('wp_rest'),
            'lang'  => Danadresse_Settings::get('language', 'da'),
        ]);
        wp_enqueue_style(
            'danadresse-checkout',
            DANADRESSE_URL . 'assets/css/checkout.css',
            [],
            DANADRESSE_VERSION
        );
    }

    public function inject_marker() {
        echo '<div id="danadresse-marker" data-source="checkout"></div>';
    }

    public function validate_address() {
        if (!Danadresse_Settings::get('datavask')) return;
        $country = sanitize_text_field($_POST['billing_country'] ?? '');
        if ($country !== 'DK') return;

        $address = sanitize_text_field($_POST['billing_address_1'] ?? '');
        $postcode = sanitize_text_field($_POST['billing_postcode'] ?? '');
        if (!$address || !$postcode) return;

        $key  = Danadresse_Settings::get('api_key');
        $base = Danadresse_Settings::get('api_base', 'https://api.danadresse.dk');
        if (!$key) return;

        // Quick datavask
        $r = wp_remote_post("$base/datavask/adgangsadresser", [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Api-Key'    => $key,
            ],
            'body' => wp_json_encode([
                'vejnavn' => $address, 'postnr' => $postcode,
            ]),
            'timeout' => 5,
        ]);
        if (is_wp_error($r)) return;
        $body = json_decode(wp_remote_retrieve_body($r), true);
        if (!is_array($body)) return;

        if (($body['kategori'] ?? 'C') === 'C') {
            wc_add_notice(__('Adressen kunne ikke verificeres. Tjek venligst og prøv igen.', 'danadresse'), 'error');
        }
    }

    public function shortcode($atts) {
        $atts = shortcode_atts(['placeholder' => __('Indtast en dansk adresse…', 'danadresse')], $atts);
        $this->enqueue();
        return sprintf(
            '<div class="danadresse-search" data-mode="standalone"><input type="text" placeholder="%s" autocomplete="off" /></div>',
            esc_attr($atts['placeholder'])
        );
    }
}
