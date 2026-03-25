/* contour-editor.js — Interactive quadratic-bezier contour line editor */

const ContourEditor = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Default contour positions — circular-arc tangent-intersection model
  // centered at bottom-left corner (0, gridH).
  // P1 = (endX, startY) gives tangent-perpendicular behavior for circular arcs.
  const REF_W = 270, REF_H = 180;
  const DEFAULT_CONTOURS = [
    {
      id: 'K', label: 'K = 269', elevation: 269, color: '#c1121f',
      start: { x: 218, y: 0 }, control: { x: 256, y: 18 }, end: { x: 270, y: 66 }
    },
    {
      id: 'L', label: 'L = 270', elevation: 270, color: '#1a759f',
      start: { x: 63, y: 0 }, control: { x: 184, y: 54 }, end: { x: 189, y: 180 }
    },
    {
      id: 'M', label: 'M = 271', elevation: 271, color: '#2a9d8f',
      start: { x: 0, y: 113 }, control: { x: 45, y: 135 }, end: { x: 54, y: 180 }
    }
  ];

  function scaleContours(contours, fromW, fromH, toW, toH) {
    if (fromW === toW && fromH === toH) return contours;
    const sx = toW / fromW, sy = toH / fromH;
    return contours.map(c => ({
      ...c,
      start:   { x: c.start.x * sx,   y: c.start.y * sy },
      control: { x: c.control.x * sx, y: c.control.y * sy },
      end:     { x: c.end.x * sx,     y: c.end.y * sy }
    }));
  }

  let cfg = {
    svg: null,
    g: null,
    scale: 1,
    gridW: 270,
    gridH: 180,
    prevW: 270,
    prevH: 180,
    contours: [],
    editing: false,
    dragInfo: null,
    paramPanel: null,
    onUpdate: null
  };

  function init(options) {
    cfg.svg = options.svg;
    cfg.scale = options.scale;
    const newW = options.gridW || 270;
    const newH = options.gridH || 180;
    cfg.paramPanel = options.paramPanel || null;
    cfg.onUpdate = options.onUpdate || null;
    cfg.editing = false;
    cfg.dragInfo = null;

    let rawContours = options.contours
      ? JSON.parse(JSON.stringify(options.contours))
      : scaleContours(JSON.parse(JSON.stringify(DEFAULT_CONTOURS)), REF_W, REF_H, newW, newH);

    if (options.contours && (newW !== cfg.prevW || newH !== cfg.prevH)) {
      rawContours = scaleContours(rawContours, cfg.prevW, cfg.prevH, newW, newH);
    }

    cfg.prevW = newW;
    cfg.prevH = newH;
    cfg.gridW = newW;
    cfg.gridH = newH;
    cfg.contours = rawContours;

    const mainG = cfg.svg.querySelector('g');
    if (cfg.g) cfg.g.remove();
    cfg.g = svgEl('g', { class: 'contour-editor-layer' }, mainG);

    cfg.svg.onpointermove = onPointerMove;
    cfg.svg.onpointerup = onPointerUp;
    cfg.svg.onpointerleave = onPointerUp;

    render();
    updatePanel();
  }

  // Extend a point to the nearest grid edge along a direction vector
  function extendToEdge(px, py, dx, dy, gW, gH) {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: px, y: py };
    let tMin = Infinity;
    const tryT = t => { if (t > 0.01) tMin = Math.min(tMin, t); };
    if (dx !== 0) { tryT(-px / dx); tryT((gW - px) / dx); }
    if (dy !== 0) { tryT(-py / dy); tryT((gH - py) / dy); }
    if (!isFinite(tMin)) return { x: px, y: py };
    return {
      x: Math.max(0, Math.min(gW, px + tMin * dx)),
      y: Math.max(0, Math.min(gH, py + tMin * dy))
    };
  }

  function isOnEdge(p, gW, gH) {
    return p.x <= 0.5 || p.x >= gW - 0.5 || p.y <= 0.5 || p.y >= gH - 0.5;
  }

  // Build intermediate contour between two main ones, extending to grid edges
  function midContour(a, b, gW, gH) {
    const mid = {
      start:   { x: (a.start.x + b.start.x) / 2,    y: (a.start.y + b.start.y) / 2 },
      control: { x: (a.control.x + b.control.x) / 2, y: (a.control.y + b.control.y) / 2 },
      end:     { x: (a.end.x + b.end.x) / 2,         y: (a.end.y + b.end.y) / 2 }
    };
    if (!isOnEdge(mid.start, gW, gH)) {
      const dx = mid.start.x - mid.control.x;
      const dy = mid.start.y - mid.control.y;
      mid.start = extendToEdge(mid.start.x, mid.start.y, dx, dy, gW, gH);
    }
    if (!isOnEdge(mid.end, gW, gH)) {
      const dx = mid.end.x - mid.control.x;
      const dy = mid.end.y - mid.control.y;
      mid.end = extendToEdge(mid.end.x, mid.end.y, dx, dy, gW, gH);
    }
    return mid;
  }

  /* ── rendering ── */

  function render() {
    if (!cfg.g) return;
    cfg.g.innerHTML = '';
    const s = cfg.scale;

    // draw intermediate (half-step) contours between adjacent main ones
    const sorted = [...cfg.contours].sort((a, b) => a.elevation - b.elevation);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const mid = midContour(a, b, cfg.gridW, cfg.gridH);
      const midElev = ((a.elevation + b.elevation) / 2).toFixed(1);
      const gM = svgEl('g', {}, cfg.g);
      svgEl('path', {
        d: qPath(mid, s),
        fill: 'none', stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '6,4', opacity: 0.6
      }, gM);
      const lt = 0.5;
      const lx = qB(lt, mid.start.x, mid.control.x, mid.end.x) * s;
      const ly = qB(lt, mid.start.y, mid.control.y, mid.end.y) * s;
      const dx = qBd(lt, mid.start.x, mid.control.x, mid.end.x);
      const dy = qBd(lt, mid.start.y, mid.control.y, mid.end.y);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 11, ny = dx / len * 11;
      const txt = svgEl('text', {
        x: lx + nx, y: ly + ny,
        'font-size': 10, fill: '#999', 'font-style': 'italic',
        'text-anchor': 'middle', 'dominant-baseline': 'central', opacity: 0.7
      }, gM);
      txt.textContent = midElev;
    }

    // draw main contours
    cfg.contours.forEach((c, ci) => {
      const gC = svgEl('g', {}, cfg.g);

      svgEl('path', {
        d: qPath(c, s),
        fill: 'none', stroke: c.color, 'stroke-width': 2.5, 'stroke-linecap': 'round'
      }, gC);

      if (cfg.editing) {
        svgEl('path', {
          d: qPath(c, s),
          fill: 'none', stroke: 'transparent', 'stroke-width': 22, cursor: 'pointer'
        }, gC);
      }

      const lt = 0.38;
      const lx = qB(lt, c.start.x, c.control.x, c.end.x) * s;
      const ly = qB(lt, c.start.y, c.control.y, c.end.y) * s;
      const dx = qBd(lt, c.start.x, c.control.x, c.end.x);
      const dy = qBd(lt, c.start.y, c.control.y, c.end.y);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 15, ny = dx / len * 15;
      const txt = svgEl('text', {
        x: lx + nx, y: ly + ny,
        'font-size': 14, fill: c.color, 'font-weight': 'bold', 'font-style': 'italic',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      }, gC);
      txt.textContent = c.label;

      if (!cfg.editing) return;

      svgEl('line', {
        x1: c.start.x * s, y1: c.start.y * s,
        x2: c.control.x * s, y2: c.control.y * s,
        stroke: '#aaa', 'stroke-width': 1, 'stroke-dasharray': '4,3'
      }, gC);
      svgEl('line', {
        x1: c.control.x * s, y1: c.control.y * s,
        x2: c.end.x * s, y2: c.end.y * s,
        stroke: '#aaa', 'stroke-width': 1, 'stroke-dasharray': '4,3'
      }, gC);

      makeCircleHandle(gC, c.start, s, ci, 'start', '#e63946');
      makeDiamondHandle(gC, c.control, s, ci, 'control', '#f4a261');
      makeCircleHandle(gC, c.end, s, ci, 'end', '#06d6a0');
    });
  }

  function qPath(c, s) {
    return `M ${c.start.x * s} ${c.start.y * s} Q ${c.control.x * s} ${c.control.y * s} ${c.end.x * s} ${c.end.y * s}`;
  }
  function qB(t, a, b, c) { return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c; }
  function qBd(t, a, b, c) { return 2 * (1 - t) * (b - a) + 2 * t * (c - b); }

  /* ── drag handles ── */

  function makeCircleHandle(parent, pt, s, ci, type, color) {
    const h = svgEl('circle', {
      cx: pt.x * s, cy: pt.y * s, r: 7,
      fill: color, stroke: '#fff', 'stroke-width': 2, cursor: 'grab'
    }, parent);
    bindDrag(h, ci, type);
  }

  function makeDiamondHandle(parent, pt, s, ci, type, color) {
    const cx = pt.x * s, cy = pt.y * s, r = 9;
    const h = svgEl('polygon', {
      points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`,
      fill: color, stroke: '#fff', 'stroke-width': 2, cursor: 'grab'
    }, parent);
    bindDrag(h, ci, type);
  }

  function bindDrag(el, ci, type) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cfg.dragInfo = { ci, type };
      el.setPointerCapture(e.pointerId);
    });
  }

  /* ── pointer events ── */

  function onPointerMove(e) {
    if (!cfg.dragInfo) return;
    e.preventDefault();
    const pt = svgCoord(e);
    const gx = pt.x / cfg.scale;
    const gy = pt.y / cfg.scale;
    const c = cfg.contours[cfg.dragInfo.ci];

    if (cfg.dragInfo.type === 'control') {
      c.control.x = Math.round(gx);
      c.control.y = Math.round(gy);
    } else {
      const snapped = snapToEdge(gx, gy);
      c[cfg.dragInfo.type].x = Math.round(snapped.x);
      c[cfg.dragInfo.type].y = Math.round(snapped.y);
    }

    render();
    updatePanel();
    if (cfg.onUpdate) cfg.onUpdate(getParams());
  }

  function onPointerUp() { cfg.dragInfo = null; }

  function svgCoord(e) {
    const pt = cfg.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = cfg.g.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function snapToEdge(x, y) {
    const W = cfg.gridW, H = cfg.gridH;
    const dists = [
      { d: Math.abs(y), p: { x: clamp(x, 0, W), y: 0 } },
      { d: Math.abs(y - H), p: { x: clamp(x, 0, W), y: H } },
      { d: Math.abs(x), p: { x: 0, y: clamp(y, 0, H) } },
      { d: Math.abs(x - W), p: { x: W, y: clamp(y, 0, H) } }
    ];
    dists.sort((a, b) => a.d - b.d);
    return dists[0].p;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── edit mode ── */

  function setEditMode(on) {
    cfg.editing = on;
    if (cfg.svg) cfg.svg.style.cursor = on ? 'crosshair' : '';
    render();
    updatePanel();
  }

  function isEditing() { return cfg.editing; }

  /* ── parameter panel ── */

  function updatePanel() {
    if (!cfg.paramPanel) return;
    const cs = cfg.contours;

    let html = '<table class="data-table" style="font-size:0.85em;margin:8px 0">' +
      '<thead><tr>' +
      '<th>Горизонталь</th>' +
      '<th><span style="color:#e63946">&#9679;</span> Початок</th>' +
      '<th><span style="color:#f4a261">&#9670;</span> Контроль</th>' +
      '<th><span style="color:#06d6a0">&#9679;</span> Кінець</th>' +
      '</tr></thead><tbody>';

    cs.forEach(c => {
      html += `<tr>
        <td style="color:${c.color};font-weight:bold">${c.label}</td>
        <td>(${c.start.x}, ${c.start.y})</td>
        <td>(${c.control.x}, ${c.control.y})</td>
        <td>(${c.end.x}, ${c.end.y})</td></tr>`;
    });
    html += '</tbody></table>';

    const json = JSON.stringify(cs.map(c => ({
      id: c.id,
      s: [c.start.x, c.start.y],
      c: [c.control.x, c.control.y],
      e: [c.end.x, c.end.y]
    })));

    html += `<details style="margin-top:6px">
      <summary style="cursor:pointer;font-size:0.85em;color:#555">Параметри JSON (для збереження / вставки)</summary>
      <textarea readonly onclick="this.select()" style="width:100%;height:55px;font-family:monospace;font-size:0.78em;margin-top:4px;resize:vertical;border:1px solid #ccc;border-radius:4px;padding:6px">${json}</textarea>
    </details>`;

    cfg.paramPanel.innerHTML = html;
  }

  /* ── get / set ── */

  function getParams() {
    return JSON.parse(JSON.stringify(cfg.contours));
  }

  function setParams(params) {
    if (!params || !params.length) return;
    params.forEach(p => {
      const c = cfg.contours.find(cc => cc.id === p.id);
      if (!c) return;
      if (p.s) {
        c.start = { x: p.s[0], y: p.s[1] };
        c.control = { x: p.c[0], y: p.c[1] };
        c.end = { x: p.e[0], y: p.e[1] };
      } else if (p.start) {
        const toObj = v => Array.isArray(v) ? { x: v[0], y: v[1] } : { ...v };
        c.start = toObj(p.start);
        c.control = toObj(p.control);
        c.end = toObj(p.end);
      }
    });
    render();
    updatePanel();
  }

  function getDefaults() {
    return scaleContours(JSON.parse(JSON.stringify(DEFAULT_CONTOURS)), REF_W, REF_H, cfg.gridW, cfg.gridH);
  }

  /* ── compute black marks from contour positions ── */
  // Interpolates vertex elevations using radial distance from bottom-left
  // through the contour system (angle-based radius lookup)

  function computeBlackMarks(gridW, gridH, cols, rows, squareA, squareB) {
    const contours = cfg.contours;
    if (!contours || contours.length === 0) return null;

    const ox = 0, oy = gridH; // center of curvature: bottom-left
    const sorted = [...contours].sort((a, b) => b.elevation - a.elevation); // highest first

    const marks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const vx = c * squareA;
        const vy = r * squareB;
        const vr = Math.hypot(vx - ox, vy - oy);
        const va = Math.atan2(vy - oy, vx - ox);

        const radii = sorted.map(ct => ({
          elev: ct.elevation,
          r: contourRadiusAtAngle(ct, va, ox, oy)
        }));

        let elev, H0 = null, l = null, L_dist = null, h_val = null;
        if (vr <= radii[0].r) {
          // Inside the highest contour — extrapolate above
          const rDiff = Math.max(radii[1].r - radii[0].r, 1);
          const grad = radii.length >= 2
            ? (radii[0].elev - radii[1].elev) / rDiff
            : 0.01;
          elev = radii[0].elev + grad * (radii[0].r - vr);
          if (radii.length >= 2) {
            H0 = radii[0].elev;
            h_val = radii[0].elev - radii[1].elev;
            L_dist = rDiff;
            l = radii[0].r - vr;
          }
        } else if (vr >= radii[radii.length - 1].r) {
          // Beyond the lowest contour — extrapolate below
          const n = radii.length - 1;
          const rDiff = n >= 1 ? Math.max(radii[n].r - radii[n - 1].r, 1) : 1;
          const grad = n >= 1
            ? (radii[n - 1].elev - radii[n].elev) / rDiff
            : 0.01;
          elev = radii[n].elev - grad * (vr - radii[n].r);
          if (n >= 1) {
            h_val = radii[n - 1].elev - radii[n].elev;
            H0 = radii[n].elev - h_val;
            L_dist = rDiff;
            l = L_dist - (vr - radii[n].r);
          }
        } else {
          // Between two contours — linear interpolation
          elev = radii[0].elev; // fallback
          for (let i = 0; i < radii.length - 1; i++) {
            if (vr >= radii[i].r && vr <= radii[i + 1].r) {
              const rDiff = Math.max(radii[i + 1].r - radii[i].r, 1);
              const t = (vr - radii[i].r) / rDiff;
              elev = radii[i].elev + t * (radii[i + 1].elev - radii[i].elev);
              H0 = radii[i + 1].elev; // lower contour
              h_val = radii[i].elev - radii[i + 1].elev;
              L_dist = rDiff;
              l = radii[i + 1].r - vr;
              break;
            }
          }
        }

        marks.push({
          elev: Math.round(elev * 100) / 100,
          H0: H0, l: l, L: L_dist, h: h_val
        });
      }
    }
    return marks;
  }

  function contourRadiusAtAngle(contour, targetAngle, ox, oy) {
    let bestDiff = Infinity;
    let bestR = 0;
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const bx = qB(t, contour.start.x, contour.control.x, contour.end.x);
      const by = qB(t, contour.start.y, contour.control.y, contour.end.y);
      const a = Math.atan2(by - oy, bx - ox);
      let diff = Math.abs(a - targetAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestR = Math.hypot(bx - ox, by - oy);
      }
    }
    return bestR;
  }

  /* ── draw contours in external SVG (non-interactive, for the full diagram) ── */

  function drawStatic(g, contourParams, scale, opacity) {
    if (!contourParams) return;
    const s = scale;
    const op = opacity || 0.5;

    // intermediate contours (extended to edges)
    const gW = cfg.gridW, gH = cfg.gridH;
    const sorted = [...contourParams].sort((a, b) => a.elevation - b.elevation);
    for (let i = 0; i < sorted.length - 1; i++) {
      const mid = midContour(sorted[i], sorted[i + 1], gW, gH);
      svgEl('path', {
        d: `M ${mid.start.x * s} ${mid.start.y * s} Q ${mid.control.x * s} ${mid.control.y * s} ${mid.end.x * s} ${mid.end.y * s}`,
        fill: 'none', stroke: '#999', 'stroke-width': 0.8, 'stroke-dasharray': '5,3',
        opacity: op * 0.6
      }, g);
    }

    // main contours
    contourParams.forEach(c => {
      svgEl('path', {
        d: `M ${c.start.x * s} ${c.start.y * s} Q ${c.control.x * s} ${c.control.y * s} ${c.end.x * s} ${c.end.y * s}`,
        fill: 'none', stroke: c.color, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: op
      }, g);
      const t = 0.38;
      const lx = qB(t, c.start.x, c.control.x, c.end.x) * s;
      const ly = qB(t, c.start.y, c.control.y, c.end.y) * s;
      const dx = qBd(t, c.start.x, c.control.x, c.end.x);
      const dy = qBd(t, c.start.y, c.control.y, c.end.y);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 12, ny = dx / len * 12;
      const txt = svgEl('text', {
        x: lx + nx, y: ly + ny,
        'font-size': 12, fill: c.color, 'font-style': 'italic', opacity: op,
        'text-anchor': 'middle'
      }, g);
      txt.textContent = c.label;
    });
  }

  return { init, setEditMode, isEditing, getParams, setParams, getDefaults, drawStatic, computeBlackMarks, DEFAULT_CONTOURS };
})();
