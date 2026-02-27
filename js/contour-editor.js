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

  let cfg = {
    svg: null,
    g: null,
    scale: 1,
    gridW: 270,
    gridH: 180,
    contours: [],
    editing: false,
    dragInfo: null,
    paramPanel: null,
    onUpdate: null
  };

  function init(options) {
    cfg.svg = options.svg;
    cfg.scale = options.scale;
    cfg.gridW = options.gridW || 270;
    cfg.gridH = options.gridH || 180;
    cfg.paramPanel = options.paramPanel || null;
    cfg.onUpdate = options.onUpdate || null;
    cfg.editing = false;
    cfg.dragInfo = null;

    cfg.contours = options.contours
      ? JSON.parse(JSON.stringify(options.contours))
      : JSON.parse(JSON.stringify(DEFAULT_CONTOURS));

    const mainG = cfg.svg.querySelector('g');
    if (cfg.g) cfg.g.remove();
    cfg.g = svgEl('g', { class: 'contour-editor-layer' }, mainG);

    cfg.svg.onpointermove = onPointerMove;
    cfg.svg.onpointerup = onPointerUp;
    cfg.svg.onpointerleave = onPointerUp;

    render();
    updatePanel();
  }

  /* ── rendering ── */

  function render() {
    if (!cfg.g) return;
    cfg.g.innerHTML = '';
    const s = cfg.scale;

    cfg.contours.forEach((c, ci) => {
      const gC = svgEl('g', {}, cfg.g);

      // visible curve
      svgEl('path', {
        d: qPath(c, s),
        fill: 'none', stroke: c.color, 'stroke-width': 2.5, 'stroke-linecap': 'round'
      }, gC);

      // fat invisible hit-area (easier clicking)
      if (cfg.editing) {
        svgEl('path', {
          d: qPath(c, s),
          fill: 'none', stroke: 'transparent', 'stroke-width': 22, cursor: 'pointer'
        }, gC);
      }

      // label near t=0.38
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

      // guide lines
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

      // handles
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

  function getDefaults() { return JSON.parse(JSON.stringify(DEFAULT_CONTOURS)); }

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

        let elev;
        if (vr <= radii[0].r) {
          // Inside the highest contour — extrapolate above
          const grad = radii.length >= 2
            ? (radii[0].elev - radii[1].elev) / Math.max(radii[1].r - radii[0].r, 1)
            : 0.01;
          elev = radii[0].elev + grad * (radii[0].r - vr);
        } else if (vr >= radii[radii.length - 1].r) {
          // Beyond the lowest contour — extrapolate below
          const n = radii.length - 1;
          const grad = n >= 1
            ? (radii[n - 1].elev - radii[n].elev) / Math.max(radii[n].r - radii[n - 1].r, 1)
            : 0.01;
          elev = radii[n].elev - grad * (vr - radii[n].r);
        } else {
          // Between two contours — linear interpolation
          elev = radii[0].elev; // fallback
          for (let i = 0; i < radii.length - 1; i++) {
            if (vr >= radii[i].r && vr <= radii[i + 1].r) {
              const t = (vr - radii[i].r) / Math.max(radii[i + 1].r - radii[i].r, 1);
              elev = radii[i].elev + t * (radii[i + 1].elev - radii[i].elev);
              break;
            }
          }
        }

        marks.push(Math.round(elev * 100) / 100);
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
    contourParams.forEach(c => {
      const s = scale;
      svgEl('path', {
        d: `M ${c.start.x * s} ${c.start.y * s} Q ${c.control.x * s} ${c.control.y * s} ${c.end.x * s} ${c.end.y * s}`,
        fill: 'none', stroke: c.color, 'stroke-width': 2, 'stroke-linecap': 'round',
        opacity: opacity || 0.5
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
        'font-size': 12, fill: c.color, 'font-style': 'italic', opacity: opacity || 0.5,
        'text-anchor': 'middle'
      }, g);
      txt.textContent = c.label;
    });
  }

  return { init, setEditMode, isEditing, getParams, setParams, getDefaults, drawStatic, computeBlackMarks, DEFAULT_CONTOURS };
})();
