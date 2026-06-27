<?php
if (!defined('ABSPATH')) exit;

class Danadresse_Settings {

    const OPT = 'danadresse_options';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_init', [$this, 'register']);
    }

    public function menu() {
        add_options_page(
            __('Danadresse', 'danadresse'),
            __('Danadresse', 'danadresse'),
            'manage_options',
            'danadresse',
            [$this, 'page']
        );
    }

    public function register() {
        register_setting('danadresse_group', self::OPT, [
            'sanitize_callback' => function ($input) {
                return [
                    'api_key'        => sanitize_text_field($input['api_key'] ?? ''),
                    'api_base'       => esc_url_raw($input['api_base'] ?? 'https://api.danadresse.dk'),
                    'autocomplete'   => !empty($input['autocomplete']),
                    'datavask'       => !empty($input['datavask']),
                    'language'       => sanitize_text_field($input['language'] ?? 'da'),
                ];
            }
        ]);

        add_settings_section('main', __('API Settings', 'danadresse'), null, 'danadresse');

        $this->field('api_key', __('API Key', 'danadresse'), 'text');
        $this->field('api_base', __('API Base URL', 'danadresse'), 'text', 'https://api.danadresse.dk');
        $this->field('autocomplete', __('Enable autocomplete on checkout', 'danadresse'), 'check');
        $this->field('datavask', __('Validate address on submit (datavask)', 'danadresse'), 'check');
        $this->field('language', __('Language', 'danadresse'), 'lang');
    }

    private function field($key, $label, $type, $default = '') {
        add_settings_field($key, $label, function () use ($key, $type, $default) {
            $o = get_option(self::OPT, []);
            $v = $o[$key] ?? $default;
            $name = self::OPT . "[$key]";
            switch ($type) {
                case 'check':
                    printf('<input type="checkbox" name="%s" value="1" %s />', esc_attr($name), checked($v, true, false));
                    break;
                case 'lang':
                    printf('<select name="%s">', esc_attr($name));
                    foreach (['da' => 'Dansk', 'en' => 'English', 'uk' => 'Українська'] as $k => $l) {
                        printf('<option value="%s" %s>%s</option>', esc_attr($k), selected($v, $k, false), esc_html($l));
                    }
                    echo '</select>';
                    break;
                default:
                    printf('<input type="text" class="regular-text" name="%s" value="%s" />',
                        esc_attr($name), esc_attr($v));
            }
        }, 'danadresse', 'main');
    }

    public function page() { ?>
        <div class="wrap">
            <h1>Danadresse</h1>
            <p>
                <?php esc_html_e('Drop-in DAWA replacement for WooCommerce checkout.', 'danadresse'); ?>
                <a href="https://danadresse.dk/dashboard/keys" target="_blank"><?php esc_html_e('Get a free API key →', 'danadresse'); ?></a>
            </p>
            <form method="post" action="options.php">
                <?php
                settings_fields('danadresse_group');
                do_settings_sections('danadresse');
                submit_button();
                ?>
            </form>
            <hr>
            <h2><?php esc_html_e('Shortcode', 'danadresse'); ?></h2>
            <p><code>[danadresse_search]</code> — <?php esc_html_e('add a standalone autocomplete input anywhere.', 'danadresse'); ?></p>
        </div>
    <?php }

    public static function get($k, $default = '') {
        $o = get_option(self::OPT, []);
        return $o[$k] ?? $default;
    }
}
