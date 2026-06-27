<?php
/**
 * Plugin Name: Danadresse for WooCommerce
 * Plugin URI:  https://danadresse.dk/wordpress
 * Description: Drop-in Danish address autocomplete + validation for WooCommerce checkout. Drop-in DAWA replacement.
 * Version:     0.1.0
 * Author:      LynBro ApS
 * Author URI:  https://lynbro.dk
 * License:     MIT
 * Text Domain: danadresse
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * WC tested up to: 9.4
 */

if (!defined('ABSPATH')) exit;

define('DANADRESSE_VERSION', '0.1.0');
define('DANADRESSE_FILE',    __FILE__);
define('DANADRESSE_PATH',    plugin_dir_path(__FILE__));
define('DANADRESSE_URL',     plugin_dir_url(__FILE__));

require_once DANADRESSE_PATH . 'includes/class-settings.php';
require_once DANADRESSE_PATH . 'includes/class-checkout.php';
require_once DANADRESSE_PATH . 'includes/class-rest.php';

add_action('plugins_loaded', function () {
    new Danadresse_Settings();
    if (class_exists('WooCommerce')) {
        new Danadresse_Checkout();
    }
    new Danadresse_Rest();
});

// HPOS compat
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables', __FILE__, true
        );
    }
});
