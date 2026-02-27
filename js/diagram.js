/* diagram.js — SVG diagrams: site plan grid, zone shading, cartogram */

const Diagram = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
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

    drawDimensions(g, sW, sH, squareA, squareB, cols, rows, scale, data.i1, 'arr-prev');

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
    if (zeroPoints && zeroPoints.length >= 2 && workingMarks) {
      drawZoneShading(g, workingMarks, cols, rows, squareA, squareB, scale);
    }

    // grid
    for (let c = 0; c < cols; c++) {
      el('line', {
        x1: c * squareA * scale, y1: 0, x2: c * squareA * scale, y2: sH,
        stroke: '#888', 'stroke-width': 1,
        'stroke-dasharray': (c === 0 || c === cols - 1) ? 'none' : '4,3'
      }, g);
    }
    for (let r = 0; r < rows; r++) {
      el('line', {
        x1: 0, y1: r * squareB * scale, x2: sW, y2: r * squareB * scale,
        stroke: '#888', 'stroke-width': 1,
        'stroke-dasharray': (r === 0 || r === rows - 1) ? 'none' : '4,3'
      }, g);
    }

    // contour curves (from editor, semi-transparent)
    if (contourParams && typeof ContourEditor !== 'undefined') {
      ContourEditor.drawStatic(g, contourParams, scale, 0.45);
    }

    // zero line
    if (zeroPoints && zeroPoints.length >= 2) {
      let zd = `M ${zeroPoints[0].x * scale} ${zeroPoints[0].y * scale}`;
      for (let i = 1; i < zeroPoints.length; i++) {
        zd += ` L ${zeroPoints[i].x * scale} ${zeroPoints[i].y * scale}`;
      }
      el('path', { d: zd, fill: 'none', stroke: '#e63946', 'stroke-width': 3, 'stroke-dasharray': '8,4' }, g);
      const mid = zeroPoints[Math.floor(zeroPoints.length / 2)];
      const txt = el('text', {
        x: mid.x * scale + 8, y: mid.y * scale - 10,
        'font-size': 13, fill: '#e63946', 'font-weight': 'bold'
      }, g);
      txt.textContent = 'Лінія нульових робіт';
    }

    // vertex marks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cx = c * squareA * scale;
        const cy = r * squareB * scale;
        el('circle', { cx, cy, r: 4, fill: '#333' }, g);

        if (redMarks && redMarks[idx] != null) {
          const t = el('text', { x: cx + 6, y: cy - 4, 'font-size': 10.5, fill: '#d62828' }, g);
          t.textContent = redMarks[idx].toFixed(2);
        }
        if (blackMarks && blackMarks[idx] != null) {
          const t = el('text', { x: cx + 6, y: cy + 15, 'font-size': 10.5, fill: '#333', 'font-weight': 'bold' }, g);
          t.textContent = blackMarks[idx].toFixed(2);
        }
        if (workingMarks && workingMarks[idx] != null) {
          const wm = workingMarks[idx];
          const t = el('text', {
            x: cx - 52, y: cy - 4,
            'font-size': 10.5, fill: wm >= 0 ? '#2a9d8f' : '#e76f51', 'font-weight': 'bold'
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

    drawDimensions(g, sW, sH, squareA, squareB, cols, rows, scale, data.i1, 'arrowhead');
  }

  // ========== Shared helpers ==========

  function drawDimensions(g, sW, sH, squareA, squareB, cols, rows, scale, i1, arrowId) {
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
    const lb = el('text', { x: dimX + 20, y: sH / 2 + 4, 'text-anchor': 'middle', 'font-size': 14, fill: '#333',
      transform: `rotate(90,${dimX + 20},${sH / 2 + 4})` }, g);
    lb.textContent = `Б = ${(rows - 1) * squareB} м`;

    const ai = el('text', { x: sW / 2, y: -20, 'text-anchor': 'middle', 'font-size': 12, fill: '#555' }, g);
    ai.textContent = 'I ─────────── I';
    const aii = el('text', { x: -20, y: sH / 2, 'text-anchor': 'middle', 'font-size': 12, fill: '#555',
      transform: `rotate(-90,-20,${sH / 2})` }, g);
    aii.textContent = 'II ────── II';

    if (i1) {
      const arrowY = -42;
      el('line', { x1: sW / 2 - 40, y1: arrowY, x2: sW / 2 + 40, y2: arrowY,
        stroke: '#333', 'stroke-width': 2, 'marker-end': `url(#${arrowId})` }, g);
      const it = el('text', { x: sW / 2 + 50, y: arrowY + 5, 'font-size': 13, fill: '#333', 'font-weight': 'bold' }, g);
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

    const { carto, volData, workingMarks, zeroPoints, cols, rows, squareA, squareB } = data;
    const nC = cols - 1, nR = rows - 1;

    const padL = 10, padT = 10;
    const siteW = 420, chartH = 130, chartW = 130, tblH = 60, gap = 2;
    const siteH = siteW * (nR * squareB) / (nC * squareA);
    const sx = siteW / (nC * squareA), sy = siteH / (nR * squareB);

    const totalW = padL + siteW + gap + chartW + tblH + 40;
    const totalH = padT + siteH + gap + chartH + tblH + 30;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('style', 'max-width:1000px');
    container.appendChild(svg);

    // hatching patterns: vertical for bottom chart, horizontal for right chart
    const defs = el('defs', {}, svg);
    makeHatchPattern(defs, 'hatchCutV', '#e76f51', 0);
    makeHatchPattern(defs, 'hatchFillV', '#2a9d8f', 0);
    makeHatchPattern(defs, 'hatchCutH', '#e76f51', 90);
    makeHatchPattern(defs, 'hatchFillH', '#2a9d8f', 90);

    // ── site plan ──
    const sX = padL, sY = padT;
    const gSite = el('g', { transform: `translate(${sX},${sY})` }, svg);
    drawCartogramSite(gSite, { carto, volData, workingMarks, zeroPoints, cols, rows, squareA, squareB, sx, sy, siteW, siteH });

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
  }

  function makeHatchPattern(defs, id, color, angle) {
    const p = el('pattern', { id, patternUnits: 'userSpaceOnUse', width: 6, height: 6,
      patternTransform: `rotate(${angle})` }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: color, 'stroke-width': 1.2, opacity: 0.45 }, p);
  }

  // ── Site plan ──
  function drawCartogramSite(g, d) {
    const { carto, volData, workingMarks, zeroPoints, cols, rows, squareA, squareB, sx, sy, siteW, siteH } = d;
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
      let zd = `M ${zeroPoints[0].x * sx} ${zeroPoints[0].y * sy}`;
      for (let i = 1; i < zeroPoints.length; i++) zd += ` L ${zeroPoints[i].x * sx} ${zeroPoints[i].y * sy}`;
      el('path', { d: zd, fill: 'none', stroke: '#333', 'stroke-width': 1.5, 'stroke-dasharray': '6,3' }, g);
      const zm = zeroPoints[Math.floor(zeroPoints.length / 2)];
      const zt = el('text', { x: zm.x * sx + 5, y: zm.y * sy - 6, 'font-size': 9, fill: '#333', 'font-style': 'italic' }, g);
      zt.textContent = 'Нульова лінія';
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
          const lt = el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 9.5,
            fill: sq.type === 'fill' ? '#2a9d8f' : '#e76f51', 'font-weight': 'bold' }, g);
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

    // vertex working marks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = c * squareA * sx, py = r * squareB * sy;
        el('circle', { cx: px, cy: py, r: 2, fill: '#333' }, g);
        if (!workingMarks) continue;
        const wm = workingMarks[r * cols + c];
        if (wm == null) continue;
        const wt = el('text', {
          x: px + (c === 0 ? 3 : c === cols - 1 ? -3 : 3),
          y: py + (r === 0 ? 12 : -4),
          'text-anchor': c === cols - 1 ? 'end' : 'start',
          'font-size': 8, fill: wm >= 0 ? '#2a9d8f' : '#e76f51'
        }, g);
        wt.textContent = (wm >= 0 ? '+' : '') + wm.toFixed(2);
      }
    }

    // M, N, Lsr
    const mxF = carto.cxFill * sx, myF = carto.cyFill * sy;
    const mxC = carto.cxCut * sx, myC = carto.cyCut * sy;
    el('line', { x1: mxF, y1: myF, x2: mxC, y2: myC, stroke: '#264653', 'stroke-width': 1.5, 'stroke-dasharray': '5,3' }, g);
    el('circle', { cx: mxF, cy: myF, r: 5, fill: '#2a9d8f', stroke: '#fff', 'stroke-width': 1.5 }, g);
    el('circle', { cx: mxC, cy: myC, r: 5, fill: '#e76f51', stroke: '#fff', 'stroke-width': 1.5 }, g);
    const tm = el('text', { x: mxF + 8, y: myF - 6, 'font-size': 10, fill: '#2a9d8f', 'font-weight': 'bold' }, g);
    tm.textContent = 'M';
    const tn = el('text', { x: mxC + 8, y: myC - 6, 'font-size': 10, fill: '#e76f51', 'font-weight': 'bold' }, g);
    tn.textContent = 'N';
    const ml = el('text', { x: (mxF + mxC) / 2, y: (myF + myC) / 2 - 8, 'text-anchor': 'middle', 'font-size': 9.5, fill: '#264653', 'font-weight': 'bold' }, g);
    ml.textContent = `L = ${carto.Lsr.toFixed(1)} м`;

    [{ x: -2, y: -4, a: 'end', l: 'A' }, { x: siteW + 2, y: -4, a: 'start', l: 'B' },
     { x: siteW + 2, y: siteH + 11, a: 'start', l: 'C' }, { x: -2, y: siteH + 11, a: 'end', l: 'D' }
    ].forEach(cr => {
      const t = el('text', { x: cr.x, y: cr.y, 'text-anchor': cr.a, 'font-size': 10, fill: '#555', 'font-weight': 'bold' }, g);
      t.textContent = cr.l;
    });
  }

  // ── Bottom chart (below site, standard upward Y-axis) ──
  function drawBottomChart(g, carto, nC, siteW, chartH) {
    const maxV = Math.max(...carto.cumColFill, ...carto.cumColCut, 1);
    const vScale = (chartH - 20) / maxV;
    const stepW = siteW / nC;
    const bY = chartH;

    // clip to chart bounds
    const clipId = 'clipBotChart';
    const defs = g.ownerSVGElement.querySelector('defs');
    const clip = el('clipPath', { id: clipId }, defs);
    el('rect', { x: -1, y: 0, width: siteW + 2, height: chartH + 1 }, clip);

    // axes
    el('line', { x1: 0, y1: bY, x2: siteW, y2: bY, stroke: '#666', 'stroke-width': 1 }, g);
    el('line', { x1: 0, y1: 0, x2: 0, y2: bY, stroke: '#666', 'stroke-width': 1 }, g);

    const yLab = el('text', { x: -6, y: chartH / 2, 'text-anchor': 'middle', 'font-size': 8,
      fill: '#555', transform: `rotate(-90,-6,${chartH / 2})` }, g);
    yLab.textContent = "Об'єм ґрунту, м³";

    // clipped group for ALL chart content
    const gc = el('g', { 'clip-path': `url(#${clipId})` }, g);

    // hatched fills between curves (vertical lines)
    hatchedBetweenUp(gc, carto.cumColCut, carto.cumColFill, nC, stepW, vScale, bY, 'url(#hatchCutV)',  'url(#hatchFillV)');

    // curve lines
    curveUp(gc, carto.cumColCut, nC, stepW, vScale, bY, '#e76f51', 2);
    curveUp(gc, carto.cumColFill, nC, stepW, vScale, bY, '#2a9d8f', 2);

    // ½V projections — match M' and N' on site plan (methodology approach)
    const lastCut = carto.cumColCut[nC], lastFill = carto.cumColFill[nC];
    halfVProj(gc, carto.cumColCut, nC, stepW, vScale, bY, lastCut / 2, '#e76f51', "N'");
    halfVProj(gc, carto.cumColFill, nC, stepW, vScale, bY, lastFill / 2, '#2a9d8f', "M'");

    // endpoint totals (outside clip so they show past the edge)
    const tc = el('text', { x: siteW + 4, y: bY - lastCut * vScale + 4, 'font-size': 9.5, fill: '#e76f51', 'font-weight': 'bold' }, g);
    tc.textContent = lastCut.toFixed(1);
    const tf = el('text', { x: siteW + 4, y: bY - lastFill * vScale + 4, 'font-size': 9.5, fill: '#2a9d8f', 'font-weight': 'bold' }, g);
    tf.textContent = lastFill.toFixed(1);

    // curve labels
    const m = Math.floor(nC / 2);
    const t1 = el('text', { x: m * stepW + 5, y: bY - carto.cumColCut[m] * vScale - 6, 'font-size': 8.5, fill: '#e76f51', 'font-style': 'italic' }, g);
    t1.textContent = "Крива об'ємів виїмки";
    const t2 = el('text', { x: m * stepW + 5, y: bY - carto.cumColFill[m] * vScale - 6, 'font-size': 8.5, fill: '#2a9d8f', 'font-style': 'italic' }, g);
    t2.textContent = "Крива об'ємів насипу";
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
      tv.textContent = carto.colCut[c].toFixed(1);
      const tn = el('text', { x: cx, y: rH * 1.65, 'text-anchor': 'middle', 'font-size': 10, fill: '#2a9d8f' }, g);
      tn.textContent = carto.colFill[c].toFixed(1);
    }
    for (let c = 0; c <= nC; c++) {
      const cx = c * squareA * sx;
      const td = el('text', { x: cx, y: rH * 2.65, 'text-anchor': 'middle', 'font-size': 10, fill: '#333' }, g);
      td.textContent = cumDist[c].toFixed(0);
    }

    // totals at the right edge
    const totCut = carto.colCut.reduce((s, v) => s + v, 0);
    const totFill = carto.colFill.reduce((s, v) => s + v, 0);
    const tx = siteW + 6;
    const ttc = el('text', { x: tx, y: rH * 0.65, 'font-size': 10, fill: '#e76f51', 'font-weight': 'bold' }, g);
    ttc.textContent = totCut.toFixed(1);
    const ttf = el('text', { x: tx, y: rH * 1.65, 'font-size': 10, fill: '#2a9d8f', 'font-weight': 'bold' }, g);
    ttf.textContent = totFill.toFixed(1);
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

    hatchedBetweenVert(gc, carto.cumRowCut, carto.cumRowFill, nR, stepH, vScale, 'url(#hatchCutH)',  'url(#hatchFillH)');
    drawCurveVert(gc, carto.cumRowCut, nR, stepH, vScale, '#e76f51', 2);
    drawCurveVert(gc, carto.cumRowFill, nR, stepH, vScale, '#2a9d8f', 2);

    // ½V projections — match M' and N' on site plan
    const lastCut = carto.cumRowCut[nR], lastFill = carto.cumRowFill[nR];
    halfVProjVert(gc, carto.cumRowCut, nR, stepH, vScale, lastCut / 2, '#e76f51');
    halfVProjVert(gc, carto.cumRowFill, nR, stepH, vScale, lastFill / 2, '#2a9d8f');

    // endpoint totals
    const tc = el('text', { x: lastCut * vScale + 3, y: siteH + 12, 'font-size': 9.5, fill: '#e76f51', 'font-weight': 'bold' }, g);
    tc.textContent = lastCut.toFixed(1);
    const tf = el('text', { x: lastFill * vScale + 3, y: siteH + 24, 'font-size': 9.5, fill: '#2a9d8f', 'font-weight': 'bold' }, g);
    tf.textContent = lastFill.toFixed(1);

    const lY = siteH * 0.55;
    const l1 = el('text', { x: chartW - 4, y: lY, 'text-anchor': 'end', 'font-size': 8.5, fill: '#e76f51',
      transform: `rotate(90,${chartW - 4},${lY})` }, g);
    l1.textContent = 'Виїмка';
    const l2 = el('text', { x: chartW - 16, y: lY, 'text-anchor': 'end', 'font-size': 8.5, fill: '#2a9d8f',
      transform: `rotate(90,${chartW - 16},${lY})` }, g);
    l2.textContent = 'Насип';
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

    for (let r = 0; r < nR; r++) {
      const cy = (r + 0.5) * squareB * sy;
      const tv = el('text', { x: rW * 0.5, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 9, fill: '#e76f51', transform: `rotate(-90,${rW * 0.5},${cy})` }, g);
      tv.textContent = carto.rowCut[r].toFixed(1);
      const tn = el('text', { x: rW * 1.5, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 9, fill: '#2a9d8f', transform: `rotate(-90,${rW * 1.5},${cy})` }, g);
      tn.textContent = carto.rowFill[r].toFixed(1);
    }
    for (let r = 0; r <= nR; r++) {
      const cy = r * squareB * sy;
      const td = el('text', { x: rW * 2.5, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 9, fill: '#333', transform: `rotate(-90,${rW * 2.5},${cy})` }, g);
      td.textContent = cumDist[r].toFixed(0);
    }
  }

  /* ── Curve helpers ── */

  // Bottom chart: standard upward Y (0 at bottom = bY, values grow up)
  function curveUp(g, cumData, n, step, vScale, bY, color, width) {
    let d = '';
    for (let i = 0; i <= n; i++) d += (i === 0 ? 'M ' : ' L ') + (i * step).toFixed(1) + ' ' + (bY - cumData[i] * vScale).toFixed(1);
    el('path', { d, fill: 'none', stroke: color, 'stroke-width': width }, g);
  }

  // Hatched areas between two curves (bottom chart, upward Y).
  function hatchedBetweenUp(g, dataA, dataB, n, step, vScale, bY, fillA, fillB) {
    for (let i = 0; i < n; i++) {
      const x0 = i * step, x1 = (i + 1) * step;
      const aY0 = bY - dataA[i] * vScale, aY1 = bY - dataA[i + 1] * vScale;
      const bY0 = bY - dataB[i] * vScale, bY1 = bY - dataB[i + 1] * vScale;
      const minY0 = Math.min(aY0, bY0), minY1 = Math.min(aY1, bY1);
      const maxY0 = Math.max(aY0, bY0), maxY1 = Math.max(aY1, bY1);

      // area from baseline to the lower curve (closer to baseline = higher Y = smaller value)
      el('path', { d: `M ${x0} ${bY} L ${x0} ${maxY0} L ${x1} ${maxY1} L ${x1} ${bY} Z`,
        fill: dataA[i] + dataA[i + 1] < dataB[i] + dataB[i + 1] ? fillA : fillB, stroke: 'none' }, g);

      // area between the two curves
      el('path', { d: `M ${x0} ${maxY0} L ${x0} ${minY0} L ${x1} ${minY1} L ${x1} ${maxY1} Z`,
        fill: dataA[i] + dataA[i + 1] < dataB[i] + dataB[i + 1] ? fillB : fillA, stroke: 'none' }, g);
    }
  }

  // Bottom chart: ½V projection — vertical from baseline to curve, horizontal to Y-axis
  function halfVProj(g, cumData, n, step, vScale, bY, halfV, color, label) {
    for (let i = 0; i < n; i++) {
      if (cumData[i] <= halfV && cumData[i + 1] >= halfV) {
        const t = (halfV - cumData[i]) / Math.max(cumData[i + 1] - cumData[i], 0.01);
        const x = (i + t) * step;
        const y = bY - halfV * vScale;
        el('line', { x1: x, y1: bY, x2: x, y2: y, stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2' }, g);
        el('line', { x1: 0, y1: y, x2: x, y2: y, stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2' }, g);
        const lt = el('text', { x: x, y: bY + 10, 'text-anchor': 'middle', 'font-size': 8, fill: color, 'font-weight': 'bold' }, g);
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
    el('path', { d, fill: 'none', stroke: color, 'stroke-width': width }, g);
  }

  // Hatched areas between two curves (right chart, rightward X).
  function hatchedBetweenVert(g, dataA, dataB, n, step, vScale, fillA, fillB) {
    for (let i = 0; i < n; i++) {
      const y0 = i * step, y1 = (i + 1) * step;
      const aX0 = dataA[i] * vScale, aX1 = dataA[i + 1] * vScale;
      const bX0 = dataB[i] * vScale, bX1 = dataB[i + 1] * vScale;
      const minX0 = Math.min(aX0, bX0), minX1 = Math.min(aX1, bX1);
      const maxX0 = Math.max(aX0, bX0), maxX1 = Math.max(aX1, bX1);

      // area from axis to the lower curve (closer to axis = smaller X value)
      el('path', { d: `M 0 ${y0} L ${minX0} ${y0} L ${minX1} ${y1} L 0 ${y1} Z`,
        fill: dataA[i] + dataA[i + 1] < dataB[i] + dataB[i + 1] ? fillA : fillB, stroke: 'none' }, g);

      // area between the two curves
      el('path', { d: `M ${minX0} ${y0} L ${maxX0} ${y0} L ${maxX1} ${y1} L ${minX1} ${y1} Z`,
        fill: dataA[i] + dataA[i + 1] < dataB[i] + dataB[i + 1] ? fillB : fillA, stroke: 'none' }, g);
    }
  }

  return { drawSitePlan, drawSitePreview, drawCartogram };
})();
