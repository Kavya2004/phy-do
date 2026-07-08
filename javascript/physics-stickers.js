// physics-stickers.js — drag-and-drop physics diagram stickers for the student whiteboard

(function () {

  // ── SVG sticker definitions ──────────────────────────────────────────────────
  const STICKERS = [
    {
      id: 'box',
      label: 'Box',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60">
        <rect x="10" y="10" width="60" height="40" fill="#e8f4fd" stroke="#333" stroke-width="2.5"/>
        <text x="40" y="35" font-family="Arial" font-size="11" fill="#333" text-anchor="middle">box</text>
      </svg>`
    },
    {
      id: 'person',
      label: 'Person',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="100" viewBox="0 0 60 100">
        <circle cx="30" cy="12" r="10" fill="#ffe0b2" stroke="#333" stroke-width="2"/>
        <line x1="30" y1="22" x2="30" y2="60" stroke="#333" stroke-width="2.5"/>
        <line x1="10" y1="35" x2="50" y2="35" stroke="#333" stroke-width="2.5"/>
        <line x1="30" y1="60" x2="15" y2="90" stroke="#333" stroke-width="2.5"/>
        <line x1="30" y1="60" x2="45" y2="90" stroke="#333" stroke-width="2.5"/>
      </svg>`
    },
    {
      id: 'incline',
      label: 'Incline',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70">
        <polygon points="5,65 95,65 95,15" fill="#e8f5e9" stroke="#333" stroke-width="2.5"/>
        <text x="70" y="55" font-family="Arial" font-size="11" fill="#333">θ</text>
      </svg>`
    },
    {
      id: 'spring',
      label: 'Spring',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40">
        <line x1="0" y1="20" x2="15" y2="20" stroke="#333" stroke-width="2.5"/>
        <polyline points="15,20 22,5 30,35 38,5 46,35 54,5 62,35 70,5 78,20" fill="none" stroke="#333" stroke-width="2.5"/>
        <line x1="78" y1="20" x2="100" y2="20" stroke="#333" stroke-width="2.5"/>
      </svg>`
    },
    {
      id: 'arrow_right',
      label: 'Force →',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="36" viewBox="0 0 90 36">
        <defs><marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#c0392b"/>
        </marker></defs>
        <line x1="5" y1="18" x2="80" y2="18" stroke="#c0392b" stroke-width="3" marker-end="url(#ah)"/>
        <text x="45" y="34" font-family="Arial" font-size="11" fill="#c0392b" text-anchor="middle">F</text>
      </svg>`
    },
    {
      id: 'arrow_up',
      label: 'Normal ↑',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="90" viewBox="0 0 36 90">
        <defs><marker id="au" markerWidth="8" markerHeight="6" refX="4" refY="6" orient="auto">
          <polygon points="0 6, 4 0, 8 6" fill="#2980b9"/>
        </marker></defs>
        <line x1="18" y1="85" x2="18" y2="10" stroke="#2980b9" stroke-width="3" marker-end="url(#au)"/>
        <text x="18" y="88" font-family="Arial" font-size="11" fill="#2980b9" text-anchor="middle">N</text>
      </svg>`
    },
    {
      id: 'arrow_down',
      label: 'Weight ↓',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="90" viewBox="0 0 36 90">
        <defs><marker id="ad" markerWidth="8" markerHeight="6" refX="4" refY="0" orient="auto">
          <polygon points="0 0, 4 6, 8 0" fill="#8e44ad"/>
        </marker></defs>
        <line x1="18" y1="5" x2="18" y2="80" stroke="#8e44ad" stroke-width="3" marker-end="url(#ad)"/>
        <text x="18" y="8" font-family="Arial" font-size="11" fill="#8e44ad" text-anchor="middle">W</text>
      </svg>`
    },
    {
      id: 'friction',
      label: 'Friction ←',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="36" viewBox="0 0 90 36">
        <defs><marker id="af" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
          <polygon points="8 0, 0 3, 8 6" fill="#e67e22"/>
        </marker></defs>
        <line x1="85" y1="18" x2="10" y2="18" stroke="#e67e22" stroke-width="3" marker-end="url(#af)"/>
        <text x="45" y="34" font-family="Arial" font-size="11" fill="#e67e22" text-anchor="middle">f</text>
      </svg>`
    },
    {
      id: 'pulley',
      label: 'Pulley',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="28" fill="#f5f5f5" stroke="#333" stroke-width="2.5"/>
        <circle cx="40" cy="40" r="8" fill="#bbb" stroke="#333" stroke-width="2"/>
        <line x1="40" y1="0" x2="40" y2="12" stroke="#333" stroke-width="2.5"/>
        <line x1="68" y1="40" x2="80" y2="40" stroke="#333" stroke-width="2.5"/>
        <text x="40" y="75" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">pulley</text>
      </svg>`
    },
    {
      id: 'pendulum',
      label: 'Pendulum',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="100" viewBox="0 0 70 100">
        <line x1="35" y1="5" x2="55" y2="75" stroke="#333" stroke-width="2"/>
        <circle cx="55" cy="82" r="10" fill="#fdd835" stroke="#333" stroke-width="2"/>
        <line x1="5" y1="5" x2="65" y2="5" stroke="#555" stroke-width="3"/>
        <text x="35" y="98" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">pendulum</text>
      </svg>`
    },
    {
      id: 'projectile',
      label: 'Projectile',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70">
        <path d="M5,65 Q50,-10 95,65" fill="none" stroke="#333" stroke-width="2" stroke-dasharray="5,3"/>
        <defs><marker id="pa" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#333"/>
        </marker></defs>
        <line x1="5" y1="65" x2="30" y2="28" stroke="#c0392b" stroke-width="2" marker-end="url(#pa)"/>
        <circle cx="5" cy="65" r="5" fill="#2980b9"/>
        <text x="50" y="68" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">projectile</text>
      </svg>`
    },
    {
      id: 'fbd',
      label: 'FBD box',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect x="35" y="35" width="30" height="30" fill="#e8f4fd" stroke="#333" stroke-width="2"/>
        <defs>
          <marker id="fa" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <polygon points="0 0,6 2.5,0 5" fill="#c0392b"/>
          </marker>
          <marker id="fb" markerWidth="6" markerHeight="5" refX="0" refY="2.5" orient="auto">
            <polygon points="6 0,0 2.5,6 5" fill="#e67e22"/>
          </marker>
          <marker id="fc" markerWidth="5" markerHeight="6" refX="2.5" refY="0" orient="auto">
            <polygon points="0 6,2.5 0,5 6" fill="#2980b9"/>
          </marker>
          <marker id="fd" markerWidth="5" markerHeight="6" refX="2.5" refY="6" orient="auto">
            <polygon points="0 0,2.5 6,5 0" fill="#8e44ad"/>
          </marker>
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
      id: 'circuit',
      label: 'Resistor',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40">
        <line x1="0" y1="20" x2="20" y2="20" stroke="#333" stroke-width="2.5"/>
        <rect x="20" y="10" width="60" height="20" fill="#fff9c4" stroke="#333" stroke-width="2.5"/>
        <line x1="80" y1="20" x2="100" y2="20" stroke="#333" stroke-width="2.5"/>
        <text x="50" y="25" font-family="Arial" font-size="11" fill="#333" text-anchor="middle">R</text>
      </svg>`
    },
    {
      id: 'wave',
      label: 'Wave',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
        <path d="M0,25 C12,5 25,5 37,25 C50,45 63,45 75,25 C87,5 100,5 112,25"
              fill="none" stroke="#333" stroke-width="2.5"/>
        <line x1="0" y1="25" x2="100" y2="25" stroke="#aaa" stroke-width="1" stroke-dasharray="3,3"/>
        <text x="50" y="48" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">wave</text>
      </svg>`
    },
    {
      id: 'axes',
      label: 'x-y Axes',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <defs>
          <marker id="xa" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill="#333"/>
          </marker>
          <marker id="ya" markerWidth="8" markerHeight="6" refX="4" refY="6" orient="auto">
            <polygon points="0 6,4 0,8 6" fill="#333"/>
          </marker>
        </defs>
        <line x1="10" y1="70" x2="75" y2="70" stroke="#333" stroke-width="2" marker-end="url(#xa)"/>
        <line x1="10" y1="70" x2="10" y2="5"  stroke="#333" stroke-width="2" marker-end="url(#ya)"/>
        <text x="77" y="74" font-family="Arial" font-size="11" fill="#333">x</text>
        <text x="3"  y="5"  font-family="Arial" font-size="11" fill="#333">y</text>
      </svg>`
    }
  ];

  // ── Build sticker tray HTML ──────────────────────────────────────────────────
  function buildStickerTray() {
    const panel = document.getElementById('studentPanel');
    if (!panel) return;

    const tray = document.createElement('div');
    tray.id = 'physicsStickerTray';
    tray.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 10px;
      background: #f7f7f7; border-top: 1px solid #ddd;
      align-items: center; overflow-x: auto;
    `;

    const label = document.createElement('span');
    label.style.cssText = `font-size: 11px; font-weight: 700; color: #555;
      text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; margin-right: 4px;`;
    label.textContent = '🧲 Drag to board:';
    tray.appendChild(label);

    STICKERS.forEach(sticker => {
      const blob = new Blob([sticker.svg], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);

      const wrap = document.createElement('div');
      wrap.title = sticker.label;
      wrap.draggable = true;
      wrap.dataset.stickerId = sticker.id;
      wrap.style.cssText = `
        cursor: grab; border: 2px solid transparent; border-radius: 6px;
        padding: 3px; background: white; transition: border-color 0.15s, transform 0.15s;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
      `;

      const img = document.createElement('img');
      img.src = url;
      img.alt = sticker.label;
      img.style.cssText = 'width: 48px; height: 48px; object-fit: contain; pointer-events: none;';
      img.dataset.svgSrc = sticker.svg;

      const lbl = document.createElement('span');
      lbl.textContent = sticker.label;
      lbl.style.cssText = 'font-size: 9px; color: #555; white-space: nowrap;';

      wrap.appendChild(img);
      wrap.appendChild(lbl);

      wrap.addEventListener('mouseenter', () => {
        wrap.style.borderColor = '#881c1c';
        wrap.style.transform = 'scale(1.1)';
      });
      wrap.addEventListener('mouseleave', () => {
        wrap.style.borderColor = 'transparent';
        wrap.style.transform = 'scale(1)';
      });

      // Store SVG string on drag
      wrap.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', sticker.id);
        e.dataTransfer.effectAllowed = 'copy';
        window._dragStickerSvg = sticker.svg;
      });

      tray.appendChild(wrap);
    });

    panel.appendChild(tray);
  }

  // ── Stamp SVG onto canvas at drop position ───────────────────────────────────
  function stampStickerOnCanvas(svgString, canvasX, canvasY) {
    const canvas = document.getElementById('studentWhiteboard');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Parse natural size from SVG width/height attrs
    const wMatch = svgString.match(/width="(\d+)"/);
    const hMatch = svgString.match(/height="(\d+)"/);
    const w = wMatch ? parseInt(wMatch[1]) : 80;
    const h = hMatch ? parseInt(hMatch[1]) : 80;

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      // Centre the sticker on the drop point
      ctx.drawImage(img, canvasX - w / 2, canvasY - h / 2, w, h);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ── Wire canvas drop events ──────────────────────────────────────────────────
  function wireCanvasDrop() {
    const canvas = document.getElementById('studentWhiteboard');
    if (!canvas) return;

    canvas.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', e => {
      e.preventDefault();
      const svgString = window._dragStickerSvg;
      if (!svgString) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      stampStickerOnCanvas(svgString, x, y);
      window._dragStickerSvg = null;
    });

    // Touch: tap a sticker chip to stamp at canvas centre (mobile fallback)
    const tray = document.getElementById('physicsStickerTray');
    if (tray) {
      tray.querySelectorAll('[data-sticker-id]').forEach(wrap => {
        const img = wrap.querySelector('img');
        if (!img) return;
        wrap.addEventListener('click', () => {
          const cx = canvas.width  / 2;
          const cy = canvas.height / 2;
          stampStickerOnCanvas(img.dataset.svgSrc, cx, cy);
        });
      });
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    buildStickerTray();
    wireCanvasDrop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Defer slightly so tutor-whiteboard.js finishes building the canvas first
    setTimeout(init, 400);
  }

})();
