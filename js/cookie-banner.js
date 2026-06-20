// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

/* GeoEscape - Cookie Banner */
/* Simple informative banner for session cookies */

(function() {
  'use strict';

  const BANNER_KEY = 'ge_cookies_seen';

  function initCookieBanner() {
    // Check if already seen
    if (localStorage.getItem(BANNER_KEY)) {
      return;
    }

    // Create banner element
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
      <div style="max-width:800px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
        <p style="margin:0;font-size:0.85rem;flex:1;">
          <i class="fa-solid fa-cookie-bite" style="margin-right:0.3rem;"></i>
          Usamos una cookie técnica necesaria para mantener tu sesión de login. 
          No usamos cookies de análisis ni publicidad.
          <a href="cookies.php" style="color:#e94560;text-decoration:underline;">Más info</a>
        </p>
        <button id="cookie-accept" style="background:#e94560;color:#fff;border:none;padding:0.4rem 1rem;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
          Entendido
        </button>
      </div>
    `;
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#16213e;border-top:2px solid #e94560;padding:0.8rem 1rem;z-index:10000;box-shadow:0 -4px 20px rgba(0,0,0,0.3);';

    document.body.appendChild(banner);

    // Close button
    document.getElementById('cookie-accept').addEventListener('click', function() {
      localStorage.setItem(BANNER_KEY, '1');
      banner.remove();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
  } else {
    initCookieBanner();
  }
})();
