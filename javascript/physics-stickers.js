// physics-stickers.js — drag-and-drop physics stickers with movable overlay

(function () {

  // ── SVG sticker definitions ──────────────────────────────────────────────────
  const STICKERS = [
    {
      id: 'box', label: 'Box',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60">
        <rect x="10" y="10" width="60" height="40" fill="#e8f4fd" stroke="#333" stroke-width="2.5"/>
        <text x="40" y="35" font-family="Arial" font-size="11" fill="#333" text-anchor="middle">box</text>
      </svg>`
    },
    {
      id: 'person', label: 'Person',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="100" viewBox="0 0 60 100">
        <circle cx="30" cy="12" r="10" fill="#ffe0b2" stroke="#333" stroke-width="2"/>
        <line x1="30" y1="22" x2="30" y2="60" stroke="#333" stroke-width="2.5"/>
        <line x1="10" y1="35" x2="50" y2="35" stroke="#333" stroke-width="2.5"/>
        <line x1="30" y1="60" x2="15" y2="90" stroke="#333" stroke-width="2.5"/>
        <line x1="30" y1="60" x2="45" y2="90" stroke="#333" stroke-width="2.5"/>
      </svg>`
    },
    {
      id: 'incline', label: 'Incline',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70">
        <polygon points="5,65 95,65 95,15" fill="#e8f5e9" stroke="#333" stroke-width="2.5"/>
        <text x="70" y="55" font-family="Arial" font-size="11" fill="#333">θ</text>
      </svg>`
    },
    {
      id: 'spring', label: 'Spring',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40">
        <line x1="0" y1="20" x2="15" y2="20" stroke="#333" stroke-width="2.5"/>
        <polyline points="15,20 22,5 30,35 38,5 46,35 54,5 62,35 70,5 78,20" fill="none" stroke="#333" stroke-width="2.5"/>
        <line x1="78" y1="20" x2="100" y2="20" stroke="#333" stroke-width="2.5"/>
      </svg>`
    },
    {
      id: 'arrow_right', label: 'Force →',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="36" viewBox="0 0 90 36">
        <defs><marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#c0392b"/></marker></defs>
        <line x1="5" y1="18" x2="80" y2="18" stroke="#c0392b" stroke-width="3" marker-end="url(#ah)"/>
        <text x="45" y="34" font-family="Arial" font-size="11" fill="#c0392b" text-anchor="middle">F</text>
      </svg>`
    },
    {
      id: 'arrow_up', label: 'Normal ↑',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="90" viewBox="0 0 36 90">
        <defs><marker id="au" markerWidth="8" markerHeight="6" refX="4" refY="6" orient="auto">
          <polygon points="0 6, 4 0, 8 6" fill="#2980b9"/></marker></defs>
        <line x1="18" y1="85" x2="18" y2="10" stroke="#2980b9" stroke-width="3" marker-end="url(#au)"/>
        <text x="18" y="88" font-family="Arial" font-size="11" fill="#2980b9" text-anchor="middle">N</text>
      </svg>`
    },
    {
      id: 'arrow_down', label: 'Weight ↓',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="90" viewBox="0 0 36 90">
        <defs><marker id="ad" markerWidth="8" markerHeight="6" refX="4" refY="0" orient="auto">
          <polygon points="0 0, 4 6, 8 0" fill="#8e44ad"/></marker></defs>
        <line x1="18" y1="5" x2="18" y2="80" stroke="#8e44ad" stroke-width="3" marker-end="url(#ad)"/>
        <text x="18" y="8" font-family="Arial" font-size="11" fill="#8e44ad" text-anchor="middle">W</text>
      </svg>`
    },
    {
      id: 'friction', label: 'Friction ←',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="36" viewBox="0 0 90 36">
        <defs><marker id="af" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
          <polygon points="8 0, 0 3, 8 6" fill="#e67e22"/></marker></defs>
        <line x1="85" y1="18" x2="10" y2="18" stroke="#e67e22" stroke-width="3" marker-end="url(#af)"/>
        <text x="45" y="34" font-family="Arial" font-size="11" fill="#e67e22" text-anchor="middle">f</text>
      </svg>`
    },
    {
      id: 'pulley', label: 'Pulley',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="28" fill="#f5f5f5" stroke="#333" stroke-width="2.5"/>
        <circle cx="40" cy="40" r="8"  fill="#bbb"    stroke="#333" stroke-width="2"/>
        <line x1="40" y1="0"  x2="40" y2="12" stroke="#333" stroke-width="2.5"/>
        <line x1="68" y1="40" x2="80" y2="40" stroke="#333" stroke-width="2.5"/>
        <text x="40" y="75" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">pulley</text>
      </svg>`
    },
    {
      id: 'pendulum', label: 'Pendulum',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="100" viewBox="0 0 70 100">
        <line x1="5" y1="5" x2="65" y2="5" stroke="#555" stroke-width="3"/>
        <line x1="35" y1="5" x2="55" y2="75" stroke="#333" stroke-width="2"/>
        <circle cx="55" cy="82" r="10" fill="#fdd835" stroke="#333" stroke-width="2"/>
        <text x="35" y="98" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">pendulum</text>
      </svg>`
    },
    {
      id: 'projectile', label: 'Projectile',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70">
        <path d="M5,65 Q50,-10 95,65" fill="none" stroke="#333" stroke-width="2" stroke-dasharray="5,3"/>
        <defs><marker id="pa" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#333"/></marker></defs>
        <line x1="5" y1="65" x2="30" y2="28" stroke="#c0392b" stroke-width="2" marker-end="url(#pa)"/>
        <circle cx="5" cy="65" r="5" fill="#2980b9"/>
        <text x="50" y="68" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">projectile</text>
      </svg>`
    },
    {
      id: 'fbd', label: 'FBD box',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect x="35" y="35" width="30" height="30" fill="#e8f4fd" stroke="#333" stroke-width="2"/>
        <defs>
          <marker id="fa" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill="#c0392b"/></marker>
          <marker id="fb" markerWidth="6" markerHeight="5" refX="0" refY="2.5" orient="auto"><polygon points="6 0,0 2.5,6 5" fill="#e67e22"/></marker>
          <marker id="fc" markerWidth="5" markerHeight="6" refX="2.5" refY="0" orient="auto"><polygon points="0 6,2.5 0,5 6" fill="#2980b9"/></marker>
          <marker id="fd" markerWidth="5" markerHeight="6" refX="2.5" refY="6" orient="auto"><polygon points="0 0,2.5 6,5 0" fill="#8e44ad"/></marker>
        </defs>
        <line x1="65" y1="50" x2="92" y2="50" stroke="#c0392b" stroke-width="2.5" marker-end="url(#fa)"/>
        <line x1="35" y1="50" x2="8"  y2="50" stroke="#e67e22" stroke-width="2.5" marker-end="url(#fb)"/>
        <line x1="50" y1="35" x2="50" y2="8"  stroke="#2980b9" stroke-width="2.5" marker-end="url(#fc)"/>
        <line x1="50" y1="65" x2="50" y2="92" stroke="#8e44ad" stroke-width="2.5" marker-end="url(#fd)"/>
        <text x="97" y="54" font-family="Arial" font-size="9" fill="#c0392b">F</text>
        <text x="2"  y="54" font-family="Arial" font-size="9" fill="#e67e22">f</text>
        <text x="46" y="7"  font-family="Arial" font-size="9" fill="#2980b9">N</text>
        <text x="46" y="100" font-family="Arial" font-size="9" fill="#8e44ad">W</text>
      </svg>`
    },
    {
      id: 'resistor', label: 'Resistor',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40">
        <line x1="0" y1="20" x2="20" y2="20" stroke="#333" stroke-width="2.5"/>
        <rect x="20" y="10" width="60" height="20" fill="#fff9c4" stroke="#333" stroke-width="2.5"/>
        <line x1="80" y1="20" x2="100" y2="20" stroke="#333" stroke-width="2.5"/>
        <text x="50" y="25" font-family="Arial" font-size="11" fill="#333" text-anchor="middle">R</text>
      </svg>`
    },
    {
      id: 'wave', label: 'Wave',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
        <path d="M0,25 C12,5 25,5 37,25 C50,45 63,45 75,25 C87,5 100,5 112,25" fill="none" stroke="#333" stroke-width="2.5"/>
        <line x1="0" y1="25" x2="100" y2="25" stroke="#aaa" stroke-width="1" stroke-dasharray="3,3"/>
        <text x="50" y="48" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">wave</text>
      </svg>`
    },
    {
      id: 'axes', label: 'x-y Axes',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <defs>
          <marker id="xa" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#333"/></marker>
          <marker id="ya" markerWidth="8" markerHeight="6" refX="4" refY="6" orient="auto"><polygon points="0 6,4 0,8 6" fill="#333"/></marker>
        </defs>
        <line x1="10" y1="70" x2="75" y2="70" stroke="#333" stroke-width="2" marker-end="url(#xa)"/>
        <line x1="10" y1="70" x2="10" y2="5"  stroke="#333" stroke-width="2" marker-end="url(#ya)"/>
        <text x="77" y="74" font-family="Arial" font-size="11" fill="#333">x</text>
        <text x="3"  y="5"  font-family="Arial" font-size="11" fill="#333">y</text>
      </svg>`
    }
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function svgToObjectUrl(svgString) {
    return URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
  }

  function parseSvgSize(svgString) {
    const w = parseInt((svgString.match(/width="(\d+)"/) || [])[1] || 80);
    const h = parseInt((svgString.match(/height="(\d+)"/) || [])[1] || 80);
    return { w, h };
  }

  // ── Tray toggle ───────────────────────────────────────────────────────────────
  window.toggleStickerTray = function () {
    const tray = document.getElementById('physicsStickerTray');
    const btn  = document.getElementById('stickerToggleBtn');
    if (!tray) return;
    const hidden = tray.classList.toggle('sticker-tray-hidden');
    if (btn) btn.style.background = hidden ? '' : '#881c1c';
    if (btn) btn.style.color      = hidden ? '' : 'white';
  };

  // ── Build tray chips ──────────────────────────────────────────────────────────
  function buildStickerTray() {
    const tray = document.getElementById('physicsStickerTray');
    if (!tray) return;

    // Get or create the inner flex row
    let inner = tray.querySelector('.sticker-tray-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'sticker-tray-inner'; tray.appendChild(inner); }

    STICKERS.forEach(sticker => {
      const url  = svgToObjectUrl(sticker.svg);
      const chip = document.createElement('div');
      chip.className = 'sticker-chip';
      chip.title     = sticker.label;
      chip.draggable = true;

      const img = document.createElement('img');
      img.src           = url;
      img.alt           = sticker.label;
      img.dataset.svgSrc = sticker.svg;

      const lbl = document.createElement('span');
      lbl.textContent = sticker.label;

      chip.appendChild(img);
      chip.appendChild(lbl);

      // ── drag from tray ──
      chip.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', sticker.id);
        e.dataTransfer.effectAllowed = 'copy';
        window._dragStickerSvg = sticker.svg;
      });

      // ── tap to place at centre (mobile / no-drag fallback) ──
      chip.addEventListener('click', () => {
        const wrapper = document.getElementById('whiteboardWrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        placeOverlaySticker(sticker.svg, rect.width / 2, rect.height / 2);
        // close tray after placing
        const trayEl = document.getElementById('physicsStickerTray');
        if (trayEl && !trayEl.classList.contains('sticker-tray-hidden')) toggleStickerTray();
      });

      inner.appendChild(chip);
    });
  }

  // ── Place a movable sticker on the overlay ────────────────────────────────────
  function placeOverlaySticker(svgString, cx, cy) {
    const overlay = document.getElementById('stickerOverlay');
    if (!overlay) return;

    const { w, h } = parseSvgSize(svgString);
    const url = svgToObjectUrl(svgString);

    // Wrapper — this is what gets dragged
    const el = document.createElement('div');
    el.className = 'placed-sticker';
    el.style.cssText = [
      `position:absolute`,
      `left:${Math.round(cx - w / 2)}px`,
      `top:${Math.round(cy - h / 2)}px`,
      `width:${w}px`,
      `height:${h}px`,
      `pointer-events:auto`,
      `z-index:11`,
      `cursor:move`,
      `box-sizing:border-box`,
      `border:2px dashed transparent`,
      `border-radius:4px`,
    ].join(';');

    // The SVG image inside
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;user-select:none;';
    img.onload = () => URL.revokeObjectURL(url);

    // Delete button — always rendered, shown via selected state
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Delete sticker';
    del.style.cssText = [
      `display:none`,
      `position:absolute`,
      `top:-14px`,
      `right:-14px`,
      `width:26px`,
      `height:26px`,
      `background:#dc3545`,
      `color:white`,
      `border:none`,
      `border-radius:50%`,
      `font-size:13px`,
      `font-weight:bold`,
      `line-height:26px`,
      `text-align:center`,
      `cursor:pointer`,
      `pointer-events:auto`,
      `z-index:20`,
      `padding:0`,
    ].join(';');

    del.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      el.remove();
      deselectAll();
    });

    el.appendChild(img);
    el.appendChild(del);
    overlay.appendChild(el);

    // Select/deselect on click — capture:true fires BEFORE canvas listeners
    el.addEventListener('pointerdown', e => {
      // If the tap is on the delete button, let its own click handler deal with it
      if (e.target === del) return;
      window._stickerActive = true;          // tell canvas to stand down
      e.stopPropagation();
      selectSticker(el);
      startDrag(e, el, overlay);
      // clear flag after this event loop tick
      setTimeout(() => { window._stickerActive = false; }, 0);
    }, { capture: true });

    selectSticker(el); // auto-select when first placed
  }

  // ── Selection state ───────────────────────────────────────────────────────────
  let _selected = null;

  function selectSticker(el) {
    deselectAll();
    _selected = el;
    el.style.borderColor = '#881c1c';
    el.style.background  = 'rgba(136,28,28,0.04)';
    const del = el.querySelector('button');
    if (del) del.style.display = 'block';
  }

  function deselectAll() {
    if (_selected) {
      _selected.style.borderColor = 'transparent';
      _selected.style.background  = 'transparent';
      const del = _selected.querySelector('button');
      if (del) del.style.display = 'none';
      _selected = null;
    }
  }

  // ── Drag-to-move ──────────────────────────────────────────────────────────────
  function startDrag(e, el, container) {
    const startX   = e.clientX;
    const startY   = e.clientY;
    const origLeft = parseInt(el.style.left) || 0;
    const origTop  = parseInt(el.style.top)  || 0;
    let moved = false;

    function onMove(ev) {
      moved = true;
      const cw   = container.offsetWidth;
      const ch   = container.offsetHeight;
      const ew   = el.offsetWidth;
      const eh   = el.offsetHeight;
      const newL = Math.max(0, Math.min(origLeft + ev.clientX - startX, cw - ew));
      const newT = Math.max(0, Math.min(origTop  + ev.clientY - startY, ch - eh));
      el.style.left = newL + 'px';
      el.style.top  = newT + 'px';
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
  }

  // ── Wire canvas drop (from tray drag) ────────────────────────────────────────
  function wireCanvasDrop() {
    const wrapper = document.getElementById('whiteboardWrapper');
    if (!wrapper) return;

    // Deselect when clicking the board background (not a sticker)
    wrapper.addEventListener('pointerdown', e => {
      if (!e.target.closest('.placed-sticker')) deselectAll();
    });

    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    wrapper.addEventListener('drop', e => {
      e.preventDefault();
      const svgString = window._dragStickerSvg;
      if (!svgString) return;
      const rect = wrapper.getBoundingClientRect();
      placeOverlaySticker(svgString, e.clientX - rect.left, e.clientY - rect.top);
      window._dragStickerSvg = null;
      // close tray after dropping
      const tray = document.getElementById('physicsStickerTray');
      if (tray && !tray.classList.contains('sticker-tray-hidden')) toggleStickerTray();
    });
  }

  // ── Hook Clear button to also remove overlay stickers ────────────────────────
  function hookClearButton() {
    const btn = document.getElementById('clearStudentButton');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const overlay = document.getElementById('stickerOverlay');
      if (overlay) overlay.innerHTML = '';
      deselectAll();
    });
  }

  // ── Snapshot whiteboard + stickers → send to tutor ───────────────────────────
  window.sendWhiteboardToTutor = function () {
    const canvas  = document.getElementById('studentWhiteboard');
    const overlay = document.getElementById('stickerOverlay');
    const btn     = document.getElementById('sendWhiteboardBtn');
    if (!canvas) return;

    // Flash feedback
    if (btn) { btn.textContent = '⏳ Sending…'; btn.disabled = true; }

    // 1. Create an offscreen canvas the same size as the whiteboard canvas
    const snap   = document.createElement('canvas');
    snap.width   = canvas.width;
    snap.height  = canvas.height;
    const ctx    = snap.getContext('2d');

    // 2. White background so the PNG isn't transparent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, snap.width, snap.height);

    // 3. Draw the whiteboard canvas content
    ctx.drawImage(canvas, 0, 0);

    // 4. Composite every placed sticker from the overlay
    const promises = [];
    if (overlay) {
      overlay.querySelectorAll('.placed-sticker').forEach(el => {
        const img = el.querySelector('img');
        if (!img || !img.complete) return;

        // Get sticker position relative to the overlay (which is same size as canvas)
        const left = parseInt(el.style.left) || 0;
        const top  = parseInt(el.style.top)  || 0;
        const w    = el.offsetWidth  || parseInt(el.style.width)  || 80;
        const h    = el.offsetHeight || parseInt(el.style.height) || 80;

        // If img src is still loading, wait for it; otherwise draw now
        if (img.naturalWidth === 0) {
          promises.push(new Promise(resolve => {
            img.onload = () => { ctx.drawImage(img, left, top, w, h); resolve(); };
          }));
        } else {
          ctx.drawImage(img, left, top, w, h);
        }
      });
    }

    // 5. After all stickers are drawn, convert to File and inject
    Promise.all(promises).then(() => {
      snap.toBlob(blob => {
        if (!blob) {
          if (btn) { btn.textContent = '📸 Send to Tutor'; btn.disabled = false; }
          return;
        }

        const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const file = new File([blob], `whiteboard-${ts}.png`, { type: 'image/png' });

        // Inject the file into the chat upload queue
        if (typeof window.injectFileIntoChat === 'function') {
          window.injectFileIntoChat(file);
        }

        // Pre-fill the input with context so the tutor knows what to look at
        const chatInput = document.getElementById('chatInput');
        if (chatInput && !chatInput.value.trim()) {
          chatInput.value = 'Here is my whiteboard. Can you look at my diagram and help me understand if it\'s correct?';
        }

        // Restore button
        if (btn) { btn.textContent = '📸 Send to Tutor'; btn.disabled = false; }

        // Scroll chat into view and focus input
        chatInput?.focus();

        // Show a subtle toast
        showSendToast();
      }, 'image/png');
    });
  };

  function showSendToast() {
    const toast = document.createElement('div');
    toast.textContent = '✅ Whiteboard added to chat — hit Send!';
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:#881c1c; color:white; padding:10px 20px; border-radius:24px;
      font-size:13px; font-weight:600; z-index:99999;
      box-shadow:0 4px 16px rgba(0,0,0,0.25);
      animation: fadeInUp 0.2s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function init() {
    buildStickerTray();
    wireCanvasDrop();
    hookClearButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 400);
  }

})();
