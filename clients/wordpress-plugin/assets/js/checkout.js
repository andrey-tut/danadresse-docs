/* Danadresse for WooCommerce — checkout JS */
(function () {
    'use strict';
    if (typeof window === 'undefined' || !window.DANADRESSE) return;

    const cfg = window.DANADRESSE;

    function bindAutocomplete(input) {
        if (input.dataset.danadresseBound) return;
        input.dataset.danadresseBound = '1';

        const dropdown = document.createElement('div');
        dropdown.className = 'danadresse-dropdown';
        dropdown.style.cssText = 'position:absolute;background:#fff;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.08);z-index:10;max-height:280px;overflow-y:auto;display:none;';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);

        let debounce = null;
        let abortCtrl = null;

        input.addEventListener('input', function () {
            clearTimeout(debounce);
            const q = input.value.trim();
            if (!q || q.length < 2) { dropdown.style.display = 'none'; return; }
            debounce = setTimeout(async () => {
                if (abortCtrl) abortCtrl.abort();
                abortCtrl = new AbortController();
                try {
                    const r = await fetch(cfg.rest + 'autocomplete?q=' + encodeURIComponent(q), {
                        signal: abortCtrl.signal,
                        headers: { 'X-WP-Nonce': cfg.nonce },
                    });
                    if (!r.ok) return;
                    const items = await r.json();
                    render(Array.isArray(items) ? items : []);
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn(e);
                }
            }, 200);
        });

        function render(items) {
            if (!items.length) { dropdown.style.display = 'none'; return; }
            dropdown.innerHTML = items.slice(0, 8).map((s, i) =>
                `<div class="danadresse-item" data-idx="${i}" style="padding:8px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:14px;">
                    <strong>${esc(s.tekst || '')}</strong>
                    <small style="color:#64748b;display:block;margin-top:2px;">${esc(s.type || '')}</small>
                </div>`
            ).join('');
            dropdown.style.display = 'block';
            dropdown.style.width = input.offsetWidth + 'px';

            dropdown.querySelectorAll('.danadresse-item').forEach(el => {
                el.addEventListener('mouseenter', () => el.style.background = '#f8fafc');
                el.addEventListener('mouseleave', () => el.style.background = '');
                el.addEventListener('click', () => {
                    const it = items[parseInt(el.dataset.idx)];
                    if (!it) return;
                    const d = it.data || {};
                    // Filling WooCommerce fields
                    fillField('billing_address_1', d.vejnavn ? `${d.vejnavn} ${d.husnr || ''}`.trim() : it.tekst);
                    if (d.postnr) fillField('billing_postcode', d.postnr);
                    if (d.postnrnavn) fillField('billing_city', d.postnrnavn);
                    if (d.etage) fillField('billing_address_2', `${d.etage}${d.dør ? '. ' + d.dør : '.'}`);
                    fillField('billing_country', 'DK');
                    dropdown.style.display = 'none';
                    if (window.jQuery) window.jQuery(document.body).trigger('update_checkout');
                });
            });
        }

        function fillField(id, val) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

        document.addEventListener('click', e => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    function init() {
        // WooCommerce checkout
        const addressInput = document.getElementById('billing_address_1');
        if (addressInput) bindAutocomplete(addressInput);
        // Shortcode standalone
        document.querySelectorAll('.danadresse-search input').forEach(bindAutocomplete);
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
    // WooCommerce update_checkout re-renders
    if (window.jQuery) window.jQuery(document.body).on('updated_checkout', init);
})();
