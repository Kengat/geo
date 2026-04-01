/* diagram.js — SVG diagrams: site plan grid, zone shading, cartogram */

const Diagram = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let zeroLineLabelSeq = 0;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildPolylinePath(points, sx = 1, sy = 1) {
    if (!points || points.length < 2) return '';
    let d = `M ${points[0].x * sx} ${points[0].y * sy}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x * sx} ${points[i].y * sy}`;
    return d;
  }

  function ensurePathId(path, prefix = 'path-label') {
    if (!path.getAttribute('id')) path.setAttribute('id', `${prefix}-${++zeroLineLabelSeq}`);
    return path.getAttribute('id');
  }

  function createOffsetPath(g, sourcePath, offset, prefix = 'path-offset') {
    const total = typeof sourcePath.getTotalLength === 'function' ? sourcePath.getTotalLength() : 0;
    if (!total || !Number.isFinite(total)) return sourcePath;

    const steps = Math.max(24, Math.min(120, Math.round(total / 6)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const len = total * (i / steps);
      const p = sourcePath.getPointAtLength(len);
      const p0 = sourcePath.getPointAtLength(Math.max(0, len - 1));
      const p1 = sourcePath.getPointAtLength(Math.min(total, len + 1));
      let tx = p1.x - p0.x;
      let ty = p1.y - p0.y;
      const tLen = Math.hypot(tx, ty) || 1;
      tx /= tLen;
      ty /= tLen;
      const nx = -ty;
      const ny = tx;
      pts.push({
        x: p.x + nx * offset,
        y: p.y + ny * offset
      });
    }

    let d = '';
    pts.forEach((pt, idx) => {
      d += `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)} `;
    });

    return el('path', {
      id: `${prefix}-${++zeroLineLabelSeq}`,
      d: d.trim(),
      fill: 'none',
      stroke: 'none',
      opacity: '0',
      'pointer-events': 'none'
    }, g);
  }

  function attachTextToPath(g, pathOrId, label, options = {}) {
    let pathEl = typeof pathOrId === 'string'
      ? g.ownerSVGElement.getElementById(pathOrId)
      : pathOrId;

    if (pathEl && options.dy) {
      pathEl = createOffsetPath(g, pathEl, Number(options.dy), options.prefix || 'path-offset');
    }

    const pathId = pathEl
      ? ensurePathId(pathEl, options.prefix || 'path-label')
      : String(pathOrId);

    const text = el('text', {
      'font-size': options.fontSize || 12,
      fill: options.fill || '#333',
      'font-weight': options.fontWeight || 'normal',
      'font-style': options.fontStyle || 'normal',
      'letter-spacing': options.letterSpacing || '0',
      'paint-order': 'stroke fill',
      stroke: options.haloColor || '#fff',
      'stroke-width': options.haloWidth || 2,
      'stroke-linejoin': 'round',
      'dominant-baseline': 'central'
    }, g);
    const textPath = el('textPath', {
      href: `#${pathId}`,
      startOffset: options.startOffset || '50%',
      'text-anchor': options.textAnchor || 'middle'
    }, text);
    textPath.textContent = label;
    return text;
  }

  function placeLabelOnLongestZeroSegment(g, points, sx, sy, label, options = {}) {
    if (!points || points.length < 2) return;

    let best = null;
    for (let i = 1; i < points.length; i++) {
      const a = { x: points[i - 1].x * sx, y: points[i - 1].y * sy };
      const b = { x: points[i].x * sx, y: points[i].y * sy };
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!best || len > best.len) best = { a, b, len };
    }

    if (!best || best.len < (options.minLength || 70)) return;

    let { a, b } = best;
    if (b.x < a.x) [a, b] = [b, a];

    const pathId = `zero-line-label-${++zeroLineLabelSeq}`;
    el('path', {
      id: pathId,
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      fill: 'none',
      stroke: 'none',
      opacity: '0',
      'pointer-events': 'none'
    }, g);

    const text = el('text', {
      'font-size': options.fontSize || 12,
      fill: options.fill || '#333',
      'font-weight': options.fontWeight || 'bold',
      'letter-spacing': options.letterSpacing || '0',
      dy: options.dy || '-2'
    }, g);
    const textPath = el('textPath', {
      href: `#${pathId}`,
      startOffset: '50%',
      'text-anchor': 'middle'
    }, text);
    textPath.textContent = label;
  }

  // ========== Site preview (grid + vertices, NO contours — those come from ContourEditor) ==========
  function drawSitePreview(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = '';

    const { cols, rows, squareA, squareB, blackMarks } = data;
    const pad = 70;
    const W = (cols - 1) * squareA;
    const H = (rows - 1) * squareB;
    const scale = Math.min(650 / W, 450 / H);
    const sW = W * scale;
    const sH = H * scale;
    const svgW = sW + pad * 2;
    const svgH = sH + pad * 2 + 30;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('style', 'max-width:' + Math.min(svgW, 850) + 'px');
    container.appendChild(svg);

    const defs = el('defs', {}, svg);
    const marker = el('marker', { id: 'arr-prev', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' }, defs);
    el('polygon', { points: '0 0, 8 3, 0 6', fill: '#333' }, marker);

    const g = el('g', { transform: `translate(${pad},${pad})` }, svg);

    // site border
    el('rect', { x: 0, y: 0, width: sW, height: sH, fill: '#fafafa', stroke: '#333', 'stroke-width': 2 }, g);

    // inner grid lines
    for (let c = 1; c < cols - 1; c++) {
      el('line', {
        x1: c * squareA * scale, y1: 0, x2: c * squareA * scale, y2: sH,
        stroke: '#bbb', 'stroke-width': 1, 'stroke-dasharray': '6,4'
      }, g);
    }
    for (let r = 1; r < rows - 1; r++) {
      el('line', {
        x1: 0, y1: r * squareB * scale, x2: sW, y2: r * squareB * scale,
        stroke: '#bbb', 'stroke-width': 1, 'stroke-dasharray': '6,4'
      }, g);
    }

    // vertex dots + black marks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * squareA * scale;
        const cy = r * squareB * scale;
        el('circle', { cx, cy, r: 3.5, fill: '#333' }, g);
        if (blackMarks) {
          const idx = r * cols + c;
          if (blackMarks[idx] != null) {
            const t = el('text', {
              x: cx + 6, y: cy + 15, 'font-size': 11, fill: '#444', 'font-weight': 'bold',
              class: 'bmark-label', 'data-idx': idx
            }, g);
            t.textContent = blackMarks[idx].toFixed(2);
          }
        }
      }
    }

    // square numbers (watermark)
    let sqN = 1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const cx = (c + 0.5) * squareA * scale;
        const cy = (r + 0.5) * squareB * scale;
        const t = el('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 20, fill: 'rgba(0,0,0,0.07)', 'font-weight': 'bold' }, g);
        t.textContent = sqN++;
      }
    }

    drawDimensions(g, sW, sH, squareA, squareB, cols, rows, scale, data.i1, data.i2, 'arr-prev');

    return { svg, g, scale, padX: pad, padY: pad, gridW: W, gridH: H };
  }

  // ========== Full site diagram (marks, zones, zero line) ==========
  function drawSitePlan(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const { cols, rows, squareA, squareB, blackMarks, redMarks, workingMarks, zeroPoints, contourParams } = data;
    const pad = 90;
    const W = (cols - 1) * squareA;
    const H = (rows - 1) * squareB;
    const scale = Math.min(700 / W, 500 / H);
    const sW = W * scale;
    const sH = H * scale;
    const svgW = sW + pad * 2;
    const svgH = sH + pad * 2 + 30;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('style', 'max-width:' + Math.min(svgW, 900) + 'px');
    container.appendChild(svg);

    const defs = el('defs', {}, svg);
    const marker = el('marker', { id: 'arrowhead', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' }, defs);
    el('polygon', { points: '0 0, 8 3, 0 6', fill: '#555' }, marker);

    const g = el('g', { transform: `translate(${pad},${pad})` }, svg);

    // zone shading
    const gZone = el('g', { class: 'svg-zone-shading' }, g);
    if (zeroPoints && zeroPoints.length >= 2 && workingMarks) {
      drawZoneShading(gZone, workingMarks, cols, rows, squareA, squareB, scale);
    }

    // grid
    const gGrid = el('g', { class: 'svg-grid' }, g);
    for (let c = 0; c < cols; c++) {
      el('line', {
        x1: c * squareA * scale, y1: 0, x2: c * squareA * scale, y2: sH,
        stroke: '#888', 'stroke-width': 1,
        'stroke-dasharray': (c === 0 || c === cols - 1) ? 'none' : '4,3'
      }, gGrid);
    }
    for (let r = 0; r < rows; r++) {
      el('line', {
        x1: 0, y1: r * squareB * scale, x2: sW, y2: r * squareB * scale,
        stroke: '#888', 'stroke-width': 1,
        'stroke-dasharray': (r === 0 || r === rows - 1) ? 'none' : '4,3'
      }, gGrid);
    }

    // contour curves (from editor, semi-transparent)
    if (contourParams && typeof ContourEditor !== 'undefined') {
      ContourEditor.drawStatic(g, contourParams, scale, 0.45);
    }

    // zero line
    const gZero = el('g', { class: 'svg-zero-line' }, g);
    if (zeroPoints && zeroPoints.length >= 2) {
      const zd = buildPolylinePath(zeroPoints, scale, scale);
      el('path', { d: zd, fill: 'none', stroke: '#e63946', 'stroke-width': 4 }, gZero);
      placeLabelOnLongestZeroSegment(gZero, zeroPoints, scale, scale, 'Лінія нульових робіт', {
        fontSize: 13,
        fill: '#e63946',
        minLength: 120,
        dy: '-6'
      });
    }

    // vertex marks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cx = c * squareA * scale;
        const cy = r * squareB * scale;
        el('circle', { cx, cy, r: 4, fill: '#333' }, g);

        if (redMarks && redMarks[idx] != null) {
          const t = el('text', {
            x: cx + 6, y: cy - 4, 'font-size': 10.5, fill: '#d62828',
            class: 'svg-red-mark', 'data-mark-role': 'red'
          }, g);
          t.textContent = redMarks[idx].toFixed(2);
        }
        if (blackMarks && blackMarks[idx] != null) {
          const t = el('text', {
            x: cx + 6, y: cy + 15, 'font-size': 10.5, fill: '#333',
            'font-weight': 'bold', class: 'svg-black-mark', 'data-mark-role': 'black'
          }, g);
          t.textContent = blackMarks[idx].toFixed(2);
        }
        if (workingMarks && workingMarks[idx] != null) {
          const wm = workingMarks[idx];
          const t = el('text', {
            x: cx - 52, y: cy - 4,
            'font-size': 10.5, fill: wm >= 0 ? '#2a9d8f' : '#e76f51',
            'font-weight': 'bold', class: 'svg-working-mark', 'data-mark-role': 'working'
          }, g);
          t.textContent = (wm >= 0 ? '+' : '') + wm.toFixed(2);
        }
      }
    }

    // square numbers
    let sqN = 1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const cx = (c + 0.5) * squareA * scale;
        const cy = (r + 0.5) * squareB * scale;
        const t = el('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 18, fill: 'rgba(0,0,0,0.08)', 'font-weight': 'bold' }, g);
        t.textContent = sqN++;
      }
    }

    drawDimensions(g, sW, sH, squareA, squareB, cols, rows, scale, data.i1, data.i2, 'arrowhead');
  }

  // ========== Shared helpers ==========

  function drawDimensions(g, sW, sH, squareA, squareB, cols, rows, scale, i1, i2, arrowId) {
    const dimY = sH + 35;
    el('line', { x1: 0, y1: dimY, x2: sW, y2: dimY, stroke: '#555', 'stroke-width': 1 }, g);
    el('line', { x1: 0, y1: dimY - 4, x2: 0, y2: dimY + 4, stroke: '#555', 'stroke-width': 1.5 }, g);
    el('line', { x1: sW, y1: dimY - 4, x2: sW, y2: dimY + 4, stroke: '#555', 'stroke-width': 1.5 }, g);
    const la = el('text', { x: sW / 2, y: dimY + 20, 'text-anchor': 'middle', 'font-size': 14, fill: '#333' }, g);
    la.textContent = `A = ${(cols - 1) * squareA} м`;

    const dimX = sW + 35;
    el('line', { x1: dimX, y1: 0, x2: dimX, y2: sH, stroke: '#555', 'stroke-width': 1 }, g);
    el('line', { x1: dimX - 4, y1: 0, x2: dimX + 4, y2: 0, stroke: '#555', 'stroke-width': 1.5 }, g);
    el('line', { x1: dimX - 4, y1: sH, x2: dimX + 4, y2: sH, stroke: '#555', 'stroke-width': 1.5 }, g);
    const lb = el('text', {
      x: dimX + 20, y: sH / 2 + 4, 'text-anchor': 'middle', 'font-size': 14, fill: '#333',
      transform: `rotate(90,${dimX + 20},${sH / 2 + 4})`
    }, g);
    lb.textContent = `Б = ${(rows - 1) * squareB} м`;

    const ai = el('text', { x: sW / 2, y: -20, 'text-anchor': 'middle', 'font-size': 12, fill: '#555' }, g);
    ai.textContent = 'I ─────────── I';
    const aii = el('text', {
      x: -20, y: sH / 2, 'text-anchor': 'middle', 'font-size': 12, fill: '#555',
      transform: `rotate(-90,-20,${sH / 2})`
    }, g);
    aii.textContent = 'II ────── II';

    // i₂ arrow on top (horizontal direction)
    if (i2) {
      const arrowY = -42;
      el('line', {
        x1: sW / 2 - 40, y1: arrowY, x2: sW / 2 + 40, y2: arrowY,
        stroke: '#333', 'stroke-width': 2, 'marker-end': `url(#${arrowId})`
      }, g);
      const it = el('text', { x: sW / 2 + 50, y: arrowY + 5, 'font-size': 13, fill: '#333', 'font-weight': 'bold' }, g);
      it.textContent = `i₂ = ${i2}`;
    }

    // i₁ arrow on left (vertical direction)
    if (i1) {
      const arrowX = -42;
      el('line', {
        x1: arrowX, y1: sH / 2 + 40, x2: arrowX, y2: sH / 2 - 40,
        stroke: '#333', 'stroke-width': 2, 'marker-end': `url(#${arrowId})`
      }, g);
      const it = el('text', { x: arrowX - 5, y: sH / 2 + 60, 'text-anchor': 'middle', 'font-size': 13, fill: '#333', 'font-weight': 'bold' }, g);
      it.textContent = `i₁ = ${i1}`;
    }
  }

  function drawZoneShading(g, workingMarks, cols, rows, squareA, squareB, scale) {
    const idx = (r, c) => r * cols + c;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const marks = [
          workingMarks[idx(r, c)], workingMarks[idx(r, c + 1)],
          workingMarks[idx(r + 1, c + 1)], workingMarks[idx(r + 1, c)]
        ];
        const pos = marks.filter(m => m >= 0).length;
        let color;
        if (pos === 4) color = 'rgba(42,157,143,0.15)';
        else if (pos === 0) color = 'rgba(231,111,81,0.15)';
        else if (pos >= 2) color = 'rgba(42,157,143,0.08)';
        else color = 'rgba(231,111,81,0.08)';
        el('rect', {
          x: c * squareA * scale, y: r * squareB * scale,
          width: squareA * scale, height: squareB * scale, fill: color
        }, g);
      }
    }
  }

  // ========== Cartogram (textbook-style) ==========
  // Layout: site plan on top, bottom chart below site, right chart right of site.
  // Tables below bottom chart and below right chart (rotated).
  function drawCartogram(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const { carto, volData, blackMarks, redMarks, workingMarks, zeroPoints, cols, rows, squareA, squareB } = data;
    const nC = cols - 1, nR = rows - 1;

    const padL = 10, padT = 10;
    const siteW = 420, chartH = 130, chartW = 130, tblH = 60, gap = 2;
    const siteH = siteW * (nR * squareB) / (nC * squareA);
    const sx = siteW / (nC * squareA), sy = siteH / (nR * squareB);

    const totalW = padL + siteW + gap + chartW + tblH + 40;
    const totalH = padT + siteH + gap + chartH + tblH + 30;

    const viewShiftLeft = 18;
    const viewShiftTop = 14;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${-viewShiftLeft} ${-viewShiftTop} ${totalW} ${totalH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('style', 'max-width:1000px');
    svg.setAttribute('class', 'diagram-svg diagram-svg-cartogram');
    svg.setAttribute('data-diagram', 'cartogram');
    container.appendChild(svg);

    // hatching patterns
    const defs = el('defs', {}, svg);
    makeHatchPattern(defs, 'hatchBetweenV', '#777', 0);
    makeHatchPattern(defs, 'hatchBetweenH', '#777', 90);

    // ── site plan ──
    const sX = padL, sY = padT;
    const gSite = el('g', { transform: `translate(${sX},${sY})` }, svg);
    drawCartogramSite(gSite, { carto, volData, blackMarks, redMarks, workingMarks, zeroPoints, cols, rows, squareA, squareB, sx, sy, siteW, siteH });

    // ── bottom chart (below site) ──
    const bChartY = sY + siteH + gap;
    const gBot = el('g', { transform: `translate(${sX},${bChartY})` }, svg);
    drawBottomChart(gBot, carto, nC, siteW, chartH);

    // ── bottom table (below bottom chart) ──
    const bTblY = bChartY + chartH;
    const gBotTbl = el('g', { transform: `translate(${sX},${bTblY})` }, svg);
    drawBottomTable(gBotTbl, carto, nC, squareA, sx, siteW);

    // ── right chart (right of site) ──
    const rChartX = sX + siteW + gap;
    const gRight = el('g', { transform: `translate(${rChartX},${sY})` }, svg);
    drawRightChart(gRight, carto, nR, siteH, chartW);

    // ── right table (right of right chart, rotated) ──
    const rTblX = rChartX + chartW;
    const gRightTbl = el('g', { transform: `translate(${rTblX},${sY})` }, svg);
    drawRightTable(gRightTbl, carto, nR, squareB, sy, siteH);

    // ── connecting lines from M/N on site plan to ½V points on charts ──
    const mxF = sX + carto.cxFill * sx, myF = sY + carto.cyFill * sy;
    const mxC = sX + carto.cxCut * sx, myC = sY + carto.cyCut * sy;
    const stepW = siteW / nC, stepH = siteH / nR;
    const halfCut = carto.cumColCut[nC] / 2, halfFill = carto.cumColFill[nC] / 2;
    const halfCutR = carto.cumRowCut[nR] / 2, halfFillR = carto.cumRowFill[nR] / 2;

    const findHalfX = (cum, n, step, half) => {
      for (let i = 0; i < n; i++) {
        if ((cum[i] <= half && cum[i + 1] >= half) || (cum[i] >= half && cum[i + 1] <= half)) {
          const t = (half - cum[i]) / (cum[i + 1] - cum[i] || 0.01);
          return (i + t) * step;
        }
      }
      return 0;
    };

    const cutXBot = sX + findHalfX(carto.cumColCut, nC, stepW, halfCut);
    const fillXBot = sX + findHalfX(carto.cumColFill, nC, stepW, halfFill);
    const cutYRight = sY + findHalfX(carto.cumRowCut, nR, stepH, halfCutR);
    const fillYRight = sY + findHalfX(carto.cumRowFill, nR, stepH, halfFillR);

    const dash = '4,3';
    const gConn = el('g', {}, svg);
    // M (cut): projection lines to both charts
    el('line', { x1: mxC, y1: myC, x2: cutXBot, y2: myC, stroke: '#e76f51', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
    el('line', { x1: cutXBot, y1: myC, x2: cutXBot, y2: sY + siteH, stroke: '#e76f51', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
    el('line', { x1: mxC, y1: myC, x2: mxC, y2: cutYRight, stroke: '#e76f51', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
    el('line', { x1: mxC, y1: cutYRight, x2: sX + siteW, y2: cutYRight, stroke: '#e76f51', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);

    // N (fill): projection lines to both charts
    el('line', { x1: mxF, y1: myF, x2: fillXBot, y2: myF, stroke: '#2a9d8f', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
    el('line', { x1: fillXBot, y1: myF, x2: fillXBot, y2: sY + siteH, stroke: '#2a9d8f', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
    el('line', { x1: mxF, y1: myF, x2: mxF, y2: fillYRight, stroke: '#2a9d8f', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
    el('line', { x1: mxF, y1: fillYRight, x2: sX + siteW, y2: fillYRight, stroke: '#2a9d8f', 'stroke-width': 1, 'stroke-dasharray': dash }, gConn);
  }

  function makeHatchPattern(defs, id, color, angle) {
    const p = el('pattern', {
      id, patternUnits: 'userSpaceOnUse', width: 6, height: 6,
      patternTransform: `rotate(${angle})`
    }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: color, 'stroke-width': 1.2, opacity: 0.45 }, p);
  }

  // ── Site plan ──
  function drawCartogramSite(g, d) {
    const { carto, volData, blackMarks, redMarks, workingMarks, zeroPoints, cols, rows, squareA, squareB, sx, sy, siteW, siteH } = d;
    const nC = cols - 1, nR = rows - 1;

    // zone shading
    for (let r = 0; r < nR; r++) {
      for (let c = 0; c < nC; c++) {
        const sq = volData.squares[r * nC + c];
        const col = sq.type === 'fill' ? 'rgba(42,157,143,0.06)' :
          sq.type === 'cut' ? 'rgba(231,111,81,0.06)' : 'none';
        if (col !== 'none') el('rect', { x: c * squareA * sx, y: r * squareB * sy, width: squareA * sx, height: squareB * sy, fill: col }, g);
      }
    }

    // grid
    el('rect', { x: 0, y: 0, width: siteW, height: siteH, fill: 'none', stroke: '#333', 'stroke-width': 1.5 }, g);
    for (let c = 1; c < cols - 1; c++)
      el('line', { x1: c * squareA * sx, y1: 0, x2: c * squareA * sx, y2: siteH, stroke: '#999', 'stroke-width': 0.5, 'stroke-dasharray': '4,3' }, g);
    for (let r = 1; r < rows - 1; r++)
      el('line', { x1: 0, y1: r * squareB * sy, x2: siteW, y2: r * squareB * sy, stroke: '#999', 'stroke-width': 0.5, 'stroke-dasharray': '4,3' }, g);

    // zero line
    if (zeroPoints && zeroPoints.length >= 2) {
      const zd = buildPolylinePath(zeroPoints, sx, sy);
      el('path', { d: zd, fill: 'none', stroke: '#333', 'stroke-width': 1.5, 'stroke-dasharray': '6,3' }, g);
      placeLabelOnLongestZeroSegment(g, zeroPoints, sx, sy, 'Нульова лінія', {
        fontSize: 9,
        fill: '#333',
        fontWeight: 'normal',
        minLength: 70,
        dy: '-4'
      });
    }

    // squares content
    for (let r = 0; r < nR; r++) {
      for (let c = 0; c < nC; c++) {
        const sq = volData.squares[r * nC + c];
        const cx = (c + 0.5) * squareA * sx, cy = (r + 0.5) * squareB * sy;

        el('circle', { cx, cy: cy - 16, r: 11, fill: '#fff', stroke: '#555', 'stroke-width': 1 }, g);
        const nt = el('text', { x: cx, y: cy - 12, 'text-anchor': 'middle', 'font-size': 11, fill: '#333', 'font-weight': 'bold' }, g);
        nt.textContent = sq.num;

        if (sq.type !== 'transition') {
          const lt = el('text', {
            x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 9.5,
            fill: sq.type === 'fill' ? '#2a9d8f' : '#e76f51', 'font-weight': 'bold'
          }, g);
          lt.textContent = sq.type === 'fill' ? 'Насип' : 'Виїмка';
          const vol = sq.type === 'cut' ? sq.cut : sq.fill;
          if (vol > 0.01) {
            const vt = el('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', 'font-size': 9, fill: '#444' }, g);
            vt.textContent = vol.toFixed(2);
          }
        } else {
          if (sq.cut > 0.01) {
            const t1 = el('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#e76f51' }, g);
            t1.textContent = 'В:' + sq.cut.toFixed(1);
          }
          if (sq.fill > 0.01) {
            const t2 = el('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#2a9d8f' }, g);
            t2.textContent = 'Н:' + sq.fill.toFixed(1);
          }
        }
      }
    }

    // vertex marks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const px = c * squareA * sx, py = r * squareB * sy;
        el('circle', { cx: px, cy: py, r: 2, fill: '#333' }, g);
        const redBlackAnchor = 'start';
        const redBlackX = px + 4;
        const redY = py - 4;
        const blackY = py + 11;
        const workingAnchor = 'end';
        const workX = px - 4;
        const workY = py - 4;

        if (redMarks && redMarks[idx] != null) {
          const rt = el('text', {
            x: redBlackX, y: redY, 'text-anchor': redBlackAnchor,
            'font-size': 8, fill: '#d62828',
            class: 'svg-red-mark', 'data-mark-role': 'red'
          }, g);
          rt.textContent = redMarks[idx].toFixed(2);
        }
        if (blackMarks && blackMarks[idx] != null) {
          const bt = el('text', {
            x: redBlackX, y: blackY, 'text-anchor': redBlackAnchor,
            'font-size': 8, fill: '#333', 'font-weight': 'bold',
            class: 'svg-black-mark', 'data-mark-role': 'black'
          }, g);
          bt.textContent = blackMarks[idx].toFixed(2);
        }
        if (workingMarks && workingMarks[idx] != null) {
          const wm = workingMarks[idx];
          const wt = el('text', {
            x: workX, y: workY, 'text-anchor': workingAnchor,
            'font-size': 8, fill: wm >= 0 ? '#2a9d8f' : '#e76f51',
            'font-weight': 'bold', class: 'svg-working-mark', 'data-mark-role': 'working'
          }, g);
          wt.textContent = (wm >= 0 ? '+' : '') + wm.toFixed(2);
        }
      }
    }

    // M, N, Lsr
    const mxF = carto.cxFill * sx, myF = carto.cyFill * sy;
    const mxC = carto.cxCut * sx, myC = carto.cyCut * sy;
    // arrowhead marker for M→N line
    const defs = g.ownerSVGElement.querySelector('defs') || el('defs', {}, g.ownerSVGElement);
    const marker = el('marker', { id: 'arrowMN', markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' }, defs);
    el('path', { d: 'M0,0 L8,3 L0,6 Z', fill: '#264653' }, marker);

    el('line', { x1: mxC, y1: myC, x2: mxF, y2: myF, stroke: '#264653', 'stroke-width': 2.2, 'marker-end': 'url(#arrowMN)' }, g);
    el('circle', { cx: mxC, cy: myC, r: 5, fill: '#e76f51', stroke: '#fff', 'stroke-width': 1.5 }, g);
    el('circle', { cx: mxF, cy: myF, r: 5, fill: '#2a9d8f', stroke: '#fff', 'stroke-width': 1.5 }, g);
    const tm = el('text', { x: mxC + 8, y: myC - 6, 'font-size': 10, fill: '#e76f51', 'font-weight': 'bold' }, g);
    tm.textContent = 'M';
    const tn = el('text', { x: mxF + 8, y: myF - 6, 'font-size': 10, fill: '#2a9d8f', 'font-weight': 'bold' }, g);
    tn.textContent = 'N';
    const lPath = el('path', {
      d: `M ${mxC} ${myC} L ${mxF} ${myF}`,
      fill: 'none',
      stroke: 'none',
      opacity: '0',
      'pointer-events': 'none'
    }, g);
    attachTextToPath(g, lPath, `L = ${carto.Lsr.toFixed(1)} м`, {
      fontSize: 9.5,
      fill: '#264653',
      fontWeight: 'bold',
      startOffset: '50%',
      dy: '-7',
      haloWidth: 2
    });

    [{ x: -4, y: 12, a: 'end', l: 'A' }, { x: siteW - 4, y: 12, a: 'end', l: 'B' },
    { x: siteW - 4, y: siteH + 12, a: 'end', l: 'C' }, { x: -4, y: siteH + 12, a: 'end', l: 'D' }
    ].forEach(cr => {
      const t = el('text', { x: cr.x, y: cr.y, 'text-anchor': cr.a, 'font-size': 10, fill: '#555', 'font-weight': 'bold' }, g);
      t.textContent = cr.l;
    });
  }

  // ── Bottom chart (below site, standard upward Y-axis, 0→total left-to-right) ──
  function drawBottomChart(g, carto, nC, siteW, chartH) {
    const maxV = Math.max(...carto.cumColFill, ...carto.cumColCut, 1);
    const vScale = (chartH - 20) / maxV;
    const stepW = siteW / nC;
    const bY = chartH;

    const clipId = 'clipBotChart';
    const defs = g.ownerSVGElement.querySelector('defs');
    const clip = el('clipPath', { id: clipId }, defs);
    el('rect', { x: -1, y: 0, width: siteW + 2, height: chartH + 1 }, clip);

    el('line', { x1: 0, y1: bY, x2: siteW, y2: bY, stroke: '#666', 'stroke-width': 1 }, g);
    el('line', { x1: 0, y1: 0, x2: 0, y2: bY, stroke: '#666', 'stroke-width': 1 }, g);

    const yLab = el('text', {
      x: -6, y: chartH / 2, 'text-anchor': 'middle', 'font-size': 8,
      fill: '#555', transform: `rotate(-90,-6,${chartH / 2})`
    }, g);
    yLab.textContent = "Об'єм ґрунту, м³";

    const gc = el('g', { 'clip-path': `url(#${clipId})` }, g);

    // gray hatching only between the two curves
    hatchOnlyBetweenUp(gc, carto.cumColCut, carto.cumColFill, nC, stepW, vScale, bY, 'url(#hatchBetweenV)');

    // curve lines
    const cutCurve = curveUp(gc, carto.cumColCut, nC, stepW, vScale, bY, '#e76f51', 2);
    const fillCurve = curveUp(gc, carto.cumColFill, nC, stepW, vScale, bY, '#2a9d8f', 2);

    // ½V projections going UPWARD from curve toward site plan (M and N)
    const lastCut = carto.cumColCut[nC], lastFill = carto.cumColFill[nC];
    halfVProjUp(gc, carto.cumColCut, nC, stepW, vScale, bY, lastCut / 2, '#e76f51', "M'");
    halfVProjUp(gc, carto.cumColFill, nC, stepW, vScale, bY, lastFill / 2, '#2a9d8f', "N'");

    // curve labels
    attachTextToPath(gc, cutCurve, "Крива об'ємів виїмки", {
      fontSize: 8.5,
      fill: '#e76f51',
      fontStyle: 'italic',
      startOffset: '42%',
      dy: '-7',
      haloWidth: 1.8
    });
    attachTextToPath(gc, fillCurve, "Крива об'ємів насипу", {
      fontSize: 8.5,
      fill: '#2a9d8f',
      fontStyle: 'italic',
      startOffset: '58%',
      dy: '-7',
      haloWidth: 1.8
    });
  }

  // ── Bottom table ──
  function drawBottomTable(g, carto, nC, squareA, sx, siteW) {
    const rH = 18;
    const h3 = rH * 3;
    for (let i = 0; i <= 3; i++) el('line', { x1: 0, y1: i * rH, x2: siteW, y2: i * rH, stroke: '#999', 'stroke-width': 0.5 }, g);
    for (let c = 0; c <= nC; c++) el('line', { x1: c * squareA * sx, y1: 0, x2: c * squareA * sx, y2: h3, stroke: '#999', 'stroke-width': 0.5 }, g);

    const lb = [
      { y: rH * 0.62, text: 'в', fill: '#e76f51' },
      { y: rH * 1.62, text: 'н', fill: '#2a9d8f' },
      { y: rH * 2.62, text: 'м', fill: '#333' }
    ];
    lb.forEach(l => {
      const t = el('text', { x: -4, y: l.y, 'text-anchor': 'end', 'font-size': 10, fill: l.fill, 'font-weight': 'bold' }, g);
      t.textContent = l.text;
    });

    const cumDist = [0];
    for (let c = 0; c < nC; c++) cumDist.push(cumDist[c] + squareA);

    for (let c = 0; c < nC; c++) {
      const cx = (c + 0.5) * squareA * sx;
      const tv = el('text', { x: cx, y: rH * 0.65, 'text-anchor': 'middle', 'font-size': 10, fill: '#e76f51' }, g);
      tv.textContent = carto.cumColCut[c + 1].toFixed(1);
      const tn = el('text', { x: cx, y: rH * 1.65, 'text-anchor': 'middle', 'font-size': 10, fill: '#2a9d8f' }, g);
      tn.textContent = carto.cumColFill[c + 1].toFixed(1);
    }
    for (let c = 0; c <= nC; c++) {
      const cx = c * squareA * sx;
      const td = el('text', { x: cx, y: rH * 2.65, 'text-anchor': 'middle', 'font-size': 10, fill: '#333' }, g);
      td.textContent = cumDist[c].toFixed(0);
    }
  }

  // ── Right chart (right of site, top-to-bottom, values grow rightward) ──
  function drawRightChart(g, carto, nR, siteH, chartW) {
    const maxV = Math.max(...carto.cumRowFill, ...carto.cumRowCut, 1);
    const vScale = (chartW - 20) / maxV;
    const stepH = siteH / nR;

    // clip
    const clipId = 'clipRightChart';
    const defs = g.ownerSVGElement.querySelector('defs');
    const clip = el('clipPath', { id: clipId }, defs);
    el('rect', { x: 0, y: -1, width: chartW + 1, height: siteH + 2 }, clip);

    el('line', { x1: 0, y1: 0, x2: 0, y2: siteH, stroke: '#666', 'stroke-width': 1 }, g);
    el('line', { x1: 0, y1: 0, x2: chartW, y2: 0, stroke: '#666', 'stroke-width': 1 }, g);

    const xLab = el('text', { x: chartW / 2, y: -5, 'text-anchor': 'middle', 'font-size': 8, fill: '#555' }, g);
    xLab.textContent = "Об'єм ґрунту, м³";

    // clipped group for ALL chart content
    const gc = el('g', { 'clip-path': `url(#${clipId})` }, g);

    hatchOnlyBetweenVert(gc, carto.cumRowCut, carto.cumRowFill, nR, stepH, vScale, 'url(#hatchBetweenH)');
    const cutCurve = drawCurveVert(gc, carto.cumRowCut, nR, stepH, vScale, '#e76f51', 2);
    const fillCurve = drawCurveVert(gc, carto.cumRowFill, nR, stepH, vScale, '#2a9d8f', 2);

    // ½V projections — match M' and N' on site plan
    const lastCut = carto.cumRowCut[nR], lastFill = carto.cumRowFill[nR];
    halfVProjVert(gc, carto.cumRowCut, nR, stepH, vScale, lastCut / 2, '#e76f51');
    halfVProjVert(gc, carto.cumRowFill, nR, stepH, vScale, lastFill / 2, '#2a9d8f');

    attachTextToPath(gc, cutCurve, "Крива об'ємів виїмки", {
      fontSize: 8.3,
      fill: '#e76f51',
      fontStyle: 'italic',
      startOffset: '44%',
      dy: '8',
      haloWidth: 1.7
    });
    attachTextToPath(gc, fillCurve, "Крива об'ємів насипу", {
      fontSize: 8.3,
      fill: '#2a9d8f',
      fontStyle: 'italic',
      startOffset: '56%',
      dy: '-7',
      haloWidth: 1.7
    });
  }

  // ── Right table (rotated, beside right chart) ──
  function drawRightTable(g, carto, nR, squareB, sy, siteH) {
    const rW = 20;
    const h3 = rW * 3;

    for (let i = 0; i <= 3; i++) el('line', { x1: i * rW, y1: 0, x2: i * rW, y2: siteH, stroke: '#999', 'stroke-width': 0.5 }, g);
    for (let r = 0; r <= nR; r++) el('line', { x1: 0, y1: r * squareB * sy, x2: h3, y2: r * squareB * sy, stroke: '#999', 'stroke-width': 0.5 }, g);

    // headers (rotated 90°)
    const headers = [
      { x: rW * 0.5, text: 'в', fill: '#e76f51' },
      { x: rW * 1.5, text: 'н', fill: '#2a9d8f' },
      { x: rW * 2.5, text: 'м', fill: '#333' }
    ];
    headers.forEach(h => {
      const t = el('text', { x: h.x, y: -4, 'text-anchor': 'middle', 'font-size': 9, fill: h.fill, 'font-weight': 'bold' }, g);
      t.textContent = h.text;
    });

    const cumDist = [0];
    for (let r = 0; r < nR; r++) cumDist.push(cumDist[r] + squareB);
    const revCumRowCut = new Array(nR).fill(0);
    const revCumRowFill = new Array(nR).fill(0);
    let accCut = 0;
    let accFill = 0;
    for (let r = nR - 1; r >= 0; r--) {
      accCut += carto.rowCut[r];
      accFill += carto.rowFill[r];
      revCumRowCut[r] = accCut;
      revCumRowFill[r] = accFill;
    }

    for (let r = 0; r < nR; r++) {
      const cy = (r + 0.5) * squareB * sy;
      const tv = el('text', {
        x: rW * 0.5, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 9, fill: '#e76f51', transform: `rotate(-90,${rW * 0.5},${cy})`
      }, g);
      tv.textContent = revCumRowCut[r].toFixed(1);
      const tn = el('text', {
        x: rW * 1.5, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 9, fill: '#2a9d8f', transform: `rotate(-90,${rW * 1.5},${cy})`
      }, g);
      tn.textContent = revCumRowFill[r].toFixed(1);
    }
    for (let r = 0; r <= nR; r++) {
      const cy = r * squareB * sy;
      const td = el('text', {
        x: rW * 2.5, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 9, fill: '#333', transform: `rotate(-90,${rW * 2.5},${cy})`
      }, g);
      td.textContent = cumDist[r].toFixed(0);
    }
  }

  /* ── Curve helpers ── */

  // Bottom chart: standard upward Y (0 at bottom = bY, values grow up)
  function curveUp(g, cumData, n, step, vScale, bY, color, width) {
    let d = '';
    for (let i = 0; i <= n; i++) d += (i === 0 ? 'M ' : ' L ') + (i * step).toFixed(1) + ' ' + (bY - cumData[i] * vScale).toFixed(1);
    return el('path', { d, fill: 'none', stroke: color, 'stroke-width': width }, g);
  }

  // Hatched areas between two curves (bottom chart, upward Y).

  // Hatch only the area between two curves (no baseline fill)
  function hatchOnlyBetweenUp(g, dataA, dataB, n, step, vScale, bY, fill) {
    for (let i = 0; i < n; i++) {
      const x0 = i * step, x1 = (i + 1) * step;
      const aY0 = bY - dataA[i] * vScale, aY1 = bY - dataA[i + 1] * vScale;
      const bY0 = bY - dataB[i] * vScale, bY1 = bY - dataB[i + 1] * vScale;
      const minY0 = Math.min(aY0, bY0), minY1 = Math.min(aY1, bY1);
      const maxY0 = Math.max(aY0, bY0), maxY1 = Math.max(aY1, bY1);
      el('path', {
        d: `M ${x0} ${maxY0} L ${x0} ${minY0} L ${x1} ${minY1} L ${x1} ${maxY1} Z`,
        fill: fill, stroke: 'none'
      }, g);
    }
  }

  // Bottom chart: ½V projection going UPWARD — from curve to top of chart (toward site plan)
  function halfVProjUp(g, cumData, n, step, vScale, bY, halfV, color, label) {
    for (let i = 0; i < n; i++) {
      if ((cumData[i] <= halfV && cumData[i + 1] >= halfV) ||
        (cumData[i] >= halfV && cumData[i + 1] <= halfV)) {
        const t = (halfV - cumData[i]) / (cumData[i + 1] - cumData[i] || 0.01);
        const x = (i + t) * step;
        const y = bY - halfV * vScale;
        // vertical: from curve point UP to top of chart (y=0)
        el('line', { x1: x, y1: y, x2: x, y2: 0, stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2' }, g);
        // horizontal: from curve point to Y-axis
        el('line', { x1: 0, y1: y, x2: x, y2: y, stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2' }, g);
        const lt = el('text', { x: x, y: -4, 'text-anchor': 'middle', 'font-size': 8, fill: color, 'font-weight': 'bold' }, g);
        lt.textContent = label;
        const vt = el('text', { x: -3, y: y + 3, 'text-anchor': 'end', 'font-size': 7, fill: color }, g);
        vt.textContent = '½V';
        break;
      }
    }
  }

  // Right chart: ½V projection — horizontal from axis to curve, vertical to top axis
  function halfVProjVert(g, cumData, n, step, vScale, halfV, color) {
    for (let i = 0; i < n; i++) {
      if (cumData[i] <= halfV && cumData[i + 1] >= halfV) {
        const t = (halfV - cumData[i]) / Math.max(cumData[i + 1] - cumData[i], 0.01);
        const y = (i + t) * step;
        const x = halfV * vScale;
        el('line', { x1: 0, y1: y, x2: x, y2: y, stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2' }, g);
        el('line', { x1: x, y1: 0, x2: x, y2: y, stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2' }, g);
        break;
      }
    }
  }

  // Right chart: top-to-bottom, values grow rightward
  function drawCurveVert(g, cumData, n, step, vScale, color, width) {
    let d = '';
    for (let i = 0; i <= n; i++) d += (i === 0 ? 'M ' : ' L ') + (cumData[i] * vScale).toFixed(1) + ' ' + (i * step).toFixed(1);
    return el('path', { d, fill: 'none', stroke: color, 'stroke-width': width }, g);
  }

  // Hatched areas between two curves (right chart, rightward X).
  function hatchOnlyBetweenVert(g, dataA, dataB, n, step, vScale, fill) {
    for (let i = 0; i < n; i++) {
      const y0 = i * step, y1 = (i + 1) * step;
      const aX0 = dataA[i] * vScale, aX1 = dataA[i + 1] * vScale;
      const bX0 = dataB[i] * vScale, bX1 = dataB[i + 1] * vScale;
      const minX0 = Math.min(aX0, bX0), minX1 = Math.min(aX1, bX1);
      const maxX0 = Math.max(aX0, bX0), maxX1 = Math.max(aX1, bX1);
      el('path', {
        d: `M ${minX0} ${y0} L ${maxX0} ${y0} L ${maxX1} ${y1} L ${minX1} ${y1} Z`,
        fill: fill, stroke: 'none'
      }, g);
    }
  }

  return { drawSitePlan, drawSitePreview, drawCartogram };
})();
