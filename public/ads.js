/**
 * Dynamic Ad Loader for StreamHub
 * Automatically fetches configuration from /api/ads and populates ad slots
 */
(function() {
  async function loadAndRenderAds() {
    try {
      const res = await fetch('/api/ads');
      if (!res.ok) return;
      const ads = await res.json();
      if (!ads) return;

      // 1. Render Header Ad
      renderAdSlot('ad-header-slot', ads.header, 'ad-watch-header');

      // 2. Render Under Player Ad (Watch Page)
      renderAdSlot('ad-under-player', ads.underPlayer);

      // 3. Render Footer Ad
      renderAdSlot('ad-footer-slot', ads.footer, 'ad-watch-footer');

      // 4. Render Floating Sticky Bottom Ad
      renderFloatingAd(ads.floating);

      // 5. Setup Popunder if enabled
      setupPopunder(ads.popunder);

      // 6. Setup Histats / Analytics Counter
      renderHistats(ads.histats);
    } catch (err) {
      console.warn('[Ads] Failed to load ads config:', err);
    }
  }

  function renderAdSlot(elementId, config, altElementId) {
    let el = document.getElementById(elementId);
    if (!el && altElementId) el = document.getElementById(altElementId);
    if (!el || !config) return;

    if (!config.enabled) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';

    // If custom HTML script is provided
    if (config.customHtml && config.customHtml.trim()) {
      el.innerHTML = `
        <div class="w-full max-w-4xl min-h-[90px] flex items-center justify-center p-2 relative overflow-hidden text-center my-2">
          ${config.customHtml}
        </div>
      `;
      // Execute any script tags inside customHtml
      const scripts = el.querySelectorAll('script');
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
      return;
    }

    // Standard Banner Link
    const targetLink = config.link || 'https://link-iklan-anda.com';
    const imageUrl = config.image || '';

    if (imageUrl) {
      el.innerHTML = `
        <div class="w-full max-w-4xl min-h-[90px] flex items-center justify-center p-2 relative overflow-hidden text-center my-2">
          <a href="${targetLink}" target="_blank" rel="noopener noreferrer" class="block max-w-full">
            <img src="${imageUrl}" alt="Sponsor Ad" class="mx-auto rounded-lg max-w-full shadow-lg hover:opacity-95 transition" />
          </a>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="w-full max-w-4xl min-h-[90px] bg-zinc-900/60 border border-dashed border-zinc-700/80 rounded-xl flex items-center justify-center p-2 relative overflow-hidden group my-2">
          <a href="${targetLink}" target="_blank" rel="noopener noreferrer" class="block max-w-full text-center">
            <div class="text-[11px] text-zinc-500 uppercase tracking-widest font-mono mb-1">Sponsor / Iklan (${elementId.includes('player') ? 'Bawah Player' : (elementId.includes('header') ? 'Header 728x90' : 'Footer')})</div>
            <div class="px-6 py-2.5 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-violet-500/20 rounded-lg text-xs font-semibold text-zinc-300 group-hover:text-white transition">
              <i class="fa-solid fa-bullhorn text-rose-400 mr-2"></i> Pasang Banner Iklan di Sini (Klik untuk Mengunjungi Link)
            </div>
          </a>
        </div>
      `;
    }
  }

  function renderFloatingAd(config) {
    const el = document.getElementById('floating-sticky-ad') || document.getElementById('floating-sticky-watch-ad');
    if (!el || !config) return;

    if (!config.enabled) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'flex';
    const linkEl = el.querySelector('a');
    if (linkEl) {
      linkEl.href = config.link || 'https://link-iklan-anda.com';
      const textSpan = linkEl.querySelector('span:not(.font-mono)');
      if (textSpan && config.text) {
        textSpan.textContent = config.text;
      }
    }
  }

  function setupPopunder(config) {
    if (!config || !config.enabled) return;

    // Collect all valid links from the 3 slots
    const candidates = [config.link1, config.link2, config.link3, config.link]
      .filter(l => l && typeof l === 'string' && l.trim().length > 0)
      .map(l => l.trim());

    if (candidates.length === 0) return;

    let popTriggered = sessionStorage.getItem('stream_pop_triggered');
    if (popTriggered) return;

    function handleFirstClick() {
      if (sessionStorage.getItem('stream_pop_triggered')) return;
      sessionStorage.setItem('stream_pop_triggered', '1');

      // Pick randomly among active candidates
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const chosenUrl = candidates[randomIndex];

      try {
        window.open(chosenUrl, '_blank');
      } catch (e) {
        console.warn('Popunder blocked by browser:', e);
      }
      window.removeEventListener('click', handleFirstClick);
    }

    window.addEventListener('click', handleFirstClick, { once: true });
  }

  function renderHistats(config) {
    if (!config || !config.enabled || !config.code || !config.code.trim()) return;
    
    // Check if histats container already created
    let histatsContainer = document.getElementById('histats_counter_wrapper');
    if (!histatsContainer) {
      histatsContainer = document.createElement('div');
      histatsContainer.id = 'histats_counter_wrapper';
      histatsContainer.className = 'flex justify-center items-center py-2 text-center opacity-85';
      
      // Append right before closing body or footer
      const footer = document.querySelector('footer');
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(histatsContainer, footer.nextSibling);
      } else {
        document.body.appendChild(histatsContainer);
      }
    }

    // Set content and execute scripts
    histatsContainer.innerHTML = config.code;
    const scripts = histatsContainer.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRenderAds);
  } else {
    loadAndRenderAds();
  }
})();
