/* schedule.js — Gantt-style calendar schedule rendering */

const Schedule = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  /**
   * Draw a Gantt chart.
   * @param {string} containerId
   * @param {Array} processes - [{name, duration (shifts), workers, shifts (1 or 2), machine}]
   */
  function drawSchedule(containerId, processes) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const rowH = 44;
    const labelW = 340;
    const headerH = 50;
    const pad = 20;

    let totalShifts = 0;
    const startShifts = [];
    for (const p of processes) {
      startShifts.push(totalShifts);
      totalShifts += Math.ceil(p.duration);
    }
    const totalDays = Math.ceil(totalShifts / (processes[0]?.shifts || 1));
    const maxDays = Math.max(totalDays, 10);

    const dayW = maxDays > 30 ? Math.max(24, Math.floor(600 / maxDays)) : 50;

    const svgW = labelW + maxDays * dayW + pad * 2;
    const svgH = headerH + processes.length * rowH + pad * 2 + 60;

    container.style.overflowX = 'auto';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', svgW + 'px');
    svg.setAttribute('height', svgH + 'px');
    container.appendChild(svg);

    const g = el('g', { transform: `translate(${pad},${pad})` }, svg);

    // header columns
    const cols = [
      { label: '№', w: 30 },
      { label: 'Назва процесу', w: 140 },
      { label: 'Об\'єм', w: 60 },
      { label: 'Машина', w: 70 },
      { label: 'Роб./зм.', w: 50 }
    ];
    let cx = 0;
    for (const col of cols) {
      el('rect', { x: cx, y: 0, width: col.w, height: headerH, fill: '#264653', stroke: '#fff', 'stroke-width': 1 }, g);
      const t = el('text', { x: cx + col.w / 2, y: headerH / 2 + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#fff', 'font-weight': 'bold' }, g);
      t.textContent = col.label;
      cx += col.w;
    }

    // day columns header
    const chartX = labelW;
    for (let d = 0; d < maxDays; d++) {
      el('rect', { x: chartX + d * dayW, y: 0, width: dayW, height: headerH, fill: '#2a9d8f', stroke: '#fff', 'stroke-width': 1 }, g);
      const t = el('text', { x: chartX + d * dayW + dayW / 2, y: headerH / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff' }, g);
      t.textContent = d + 1;
    }

    // rows
    let cumulativeDay = 0;
    for (let i = 0; i < processes.length; i++) {
      const p = processes[i];
      const y = headerH + i * rowH;
      const bgColor = i % 2 === 0 ? '#f8f9fa' : '#fff';
      el('rect', { x: 0, y, width: svgW - pad * 2, height: rowH, fill: bgColor }, g);

      // data cells
      const vals = [
        (i + 1).toString(),
        p.name.length > 22 ? p.name.substring(0, 20) + '…' : p.name,
        p.volumeStr || '',
        p.machine || '',
        `${p.workers}×${p.shifts}`
      ];
      let rx = 0;
      for (let j = 0; j < cols.length; j++) {
        el('rect', { x: rx, y, width: cols[j].w, height: rowH, fill: 'none', stroke: '#ddd', 'stroke-width': 1 }, g);
        const t = el('text', { x: rx + 4, y: y + rowH / 2 + 4, 'font-size': 10, fill: '#333' }, g);
        t.textContent = vals[j];
        rx += cols[j].w;
      }

      // Gantt bar
      const durDays = Math.ceil(p.duration / p.shifts);
      const barX = chartX + cumulativeDay * dayW;
      const barW = durDays * dayW;
      const barY = y + 8;
      const barH = rowH - 16;

      // shift 1 — solid
      el('rect', { x: barX, y: barY, width: barW, height: p.shifts === 2 ? barH / 2 : barH, rx: 4, fill: '#457b9d' }, g);

      // shift 2 — dashed pattern
      if (p.shifts === 2) {
        el('rect', {
          x: barX, y: barY + barH / 2, width: barW, height: barH / 2, rx: 4,
          fill: 'none', stroke: '#457b9d', 'stroke-width': 2, 'stroke-dasharray': '6,3'
        }, g);
      }

      // duration text
      const dt = el('text', {
        x: barX + barW / 2, y: barY + barH / 2 + 4,
        'text-anchor': 'middle', 'font-size': 10, fill: '#fff', 'font-weight': 'bold'
      }, g);
      dt.textContent = `${durDays} дн.`;

      cumulativeDay += durDays;
    }

    // grid lines for days
    for (let d = 0; d <= maxDays; d++) {
      el('line', {
        x1: chartX + d * dayW, y1: headerH,
        x2: chartX + d * dayW, y2: headerH + processes.length * rowH,
        stroke: '#eee', 'stroke-width': 1
      }, g);
    }

    // worker count graph at bottom
    const graphY = headerH + processes.length * rowH + 20;
    const graphH = 40;
    const workersByDay = new Array(maxDays).fill(0);
    let cd2 = 0;
    for (const p of processes) {
      const durDays = Math.ceil(p.duration / p.shifts);
      for (let d = 0; d < durDays; d++) {
        if (cd2 + d < maxDays) {
          workersByDay[cd2 + d] += p.workers * p.shifts;
        }
      }
      cd2 += durDays;
    }
    const maxW = Math.max(...workersByDay, 1);
    const wScale = graphH / maxW;

    const tl = el('text', { x: chartX - 5, y: graphY + graphH / 2 + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#555' }, g);
    tl.textContent = 'Робітники';

    el('line', { x1: chartX, y1: graphY + graphH, x2: chartX + maxDays * dayW, y2: graphY + graphH, stroke: '#999', 'stroke-width': 1 }, g);

    let wd = `M ${chartX} ${graphY + graphH}`;
    for (let d = 0; d < maxDays; d++) {
      const y1 = graphY + graphH - workersByDay[d] * wScale;
      wd += ` L ${chartX + d * dayW} ${y1} L ${chartX + (d + 1) * dayW} ${y1}`;
    }
    wd += ` L ${chartX + maxDays * dayW} ${graphY + graphH} Z`;
    el('path', { d: wd, fill: 'rgba(69,123,157,0.25)', stroke: '#457b9d', 'stroke-width': 2 }, g);

    for (let d = 0; d < maxDays; d++) {
      if (workersByDay[d] > 0) {
        const nt = el('text', {
          x: chartX + d * dayW + dayW / 2,
          y: graphY + graphH - workersByDay[d] * wScale - 4,
          'text-anchor': 'middle', 'font-size': 9, fill: '#457b9d'
        }, g);
        nt.textContent = workersByDay[d];
      }
    }
  }

  return { drawSchedule };
})();
