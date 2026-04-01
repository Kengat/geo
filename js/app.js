/* app.js — Main controller: input handling, step rendering, calculation cascade */

document.addEventListener('DOMContentLoaded', () => {
  const state = {};

  // ===== Build vertex table (simple grid of black marks) =====
  function buildVertexTable() {
    const A = parseFloat(document.getElementById('paramA').value) || 270;
    const B = parseFloat(document.getElementById('paramB').value) || 180;
    const gridSide = parseFloat(document.getElementById('gridSide').value) || 90;
    const cols = Math.round(A / gridSide) + 1;
    const rows = Math.round(B / gridSide) + 1;
    state.cols = cols;
    state.rows = rows;
    state.squareA = gridSide;
    state.squareB = gridSide;

    const wrap = document.getElementById('vertexTableWrap');

    let html = '<table class="vertex-table"><thead><tr><th></th>';
    for (let c = 0; c < cols; c++) html += `<th>${c * gridSide} м</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += `<tr><td class="row-label"><strong>${r * gridSide} м</strong></td>`;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const corner = vertexCorner(r, c, cols, rows);
        html += `<td><input type="number" step="0.01" id="vDirect_${idx}" class="v-input bmark-input" placeholder="—">${corner ? `<span class="corner-label">${corner}</span>` : ''}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function vertexCorner(r, c, cols, rows) {
    if (r === 0 && c === 0) return 'A';
    if (r === 0 && c === cols - 1) return 'B';
    if (r === rows - 1 && c === cols - 1) return 'C';
    if (r === rows - 1 && c === 0) return 'D';
    return '';
  }

  // ===== Gather inputs =====
  function gatherInputs() {
    const A = parseFloat(document.getElementById('paramA').value);
    const B = parseFloat(document.getElementById('paramB').value);
    const i1 = parseFloat(document.getElementById('paramI1').value) || 0;
    const i2 = parseFloat(document.getElementById('paramI2').value) || 0;
    const topsoil = parseFloat(document.getElementById('paramTopsoil').value) || 0.2;
    const soilId = document.getElementById('paramSoil').value;
    const soil = Machines.soilTypes.find(s => s.id === soilId) || Machines.soilTypes[0];
    const tShift = parseFloat(document.getElementById('paramShiftHours').value) || 8;
    const numShifts = parseInt(document.getElementById('paramNumShifts').value) || 1;
    const calcMode = document.getElementById('paramCalcMode')?.value || 'normative';

    const n = state.cols * state.rows;
    const blackMarks = [];
    for (let i = 0; i < n; i++) {
      const v = parseFloat(document.getElementById(`vDirect_${i}`)?.value);
      blackMarks.push(!isNaN(v) && v > 0 ? v : 270);
    }

    let blackMarksDetails = new Array(n).fill({ H0: '-', l: '-', L: '-', h: '-' });
    if (typeof ContourEditor !== 'undefined') {
      const { cols, rows, squareA, squareB } = state;
      const W = (cols - 1) * squareA;
      const H = (rows - 1) * squareB;
      const computedMarks = ContourEditor.computeBlackMarks(W, H, cols, rows, squareA, squareB);
      if (computedMarks) {
        blackMarksDetails = computedMarks;
      }
    }

    return { A, B, i1, i2, topsoil, soil, tShift, numShifts, calcMode, blackMarks, blackMarksDetails };
  }

  // ===== Run all calculations =====
  function runCalculations() {
    const inp = gatherInputs();
    const { cols, rows, squareA, squareB } = state;
    const results = document.getElementById('results');
    results.innerHTML = '';

    // Step 1: Black marks
    renderStep1(results, inp, cols, rows);

    // Step 2: Average planning mark
    const Hser = Calc.averagePlanningMark(inp.blackMarks, cols, rows);
    renderStep2(results, inp.blackMarks, Hser, cols, rows);

    // Step 3: Red marks
    const redMarks = Calc.computeRedMarks(Hser, inp.A, inp.B, inp.i1, inp.i2, cols, rows);
    renderStep3(results, redMarks, Hser, inp, cols, rows);

    // Step 4: Working marks
    const workingMarks = Calc.computeWorkingMarks(redMarks, inp.blackMarks);
    renderStep4(results, inp.blackMarks, redMarks, workingMarks, cols, rows);

    // Step 5: Zero line
    const zeroPoints = Calc.computeZeroPoints(workingMarks, cols, rows, squareA, squareB);
    renderStep5(results, zeroPoints, squareA, squareB);

    // Step 6: Volumes
    const volData = Calc.computeVolumes(workingMarks, cols, rows, squareA);
    const balance = Calc.balanceCheck(volData.totalFill, volData.totalCut, (inp.soil.kResidual - 1) * 100);
    renderStep6(results, volData, balance, inp.soil);

    // Site diagram (contours come from the interactive editor)
    const contourParams = typeof ContourEditor !== 'undefined' ? ContourEditor.getParams() : null;
    renderSiteDiagram(results, {
      cols, rows, squareA, squareB,
      blackMarks: inp.blackMarks, redMarks, workingMarks,
      zeroPoints, contourParams, i1: inp.i1, i2: inp.i2
    });

    // Step 7: Cartogram
    const carto = Calc.computeCartogram(volData, cols, rows, squareA, squareB);
    renderStep7(results, carto, volData, workingMarks, zeroPoints, cols, rows, squareA, squareB);

    // Step 8: Process structure
    const maxVol = balance.maxVol;
    const processes = Calc.processVolumes(inp.A, inp.B, volData.totalFill, volData.totalCut, inp.soil.kInitial, inp.soil.kResidual);
    renderStep8(results, processes);

    // Step 9-11: Machine selection & TEP
    const suggestions = Machines.suggestMachines(maxVol, carto.Lsr);
    const tepResults = renderSteps9to11(results, suggestions, processes, volData, carto, inp, maxVol);

    // Step 12: Labour cost calculation
    renderStep12Logical(results, tepResults, inp);

    // Step 13: Calendar schedule
    renderStep13Logical(results, tepResults, inp);

    // Save to window for PDF export
    window.geoData = {
      inp, cols, rows, squareA, squareB,
      Hser, redMarks, workingMarks, zeroPoints,
      volData, balance, contourParams, carto, processes,
      suggestions, tepResults, maxVol
    };

    // open first section
    results.querySelectorAll('.step-section').forEach((s, i) => {
      if (i < 2) s.classList.add('open');
    });

    const btnPdf = document.getElementById('btnPreviewPdf');
    if (btnPdf) btnPdf.style.display = 'inline-block';
  }

  // ===== Step renderers =====

  function makeStep(parent, num, title) {
    const sec = document.createElement('div');
    sec.className = 'step-section';
    sec.innerHTML = `<div class="step-header">
      <span class="step-number">${num}</span>
      <span class="step-title">${title}</span>
      <span class="step-toggle">&#9660;</span>
    </div><div class="step-body"><div class="step-content"></div></div>`;
    parent.appendChild(sec);
    sec.querySelector('.step-header').onclick = () => sec.classList.toggle('open');
    return sec.querySelector('.step-content');
  }

  function renderStep1(parent, inp, cols, rows) {
    const c = makeStep(parent, 1, 'Чорні відмітки вершин');
    let html = '<div class="formula-block"><span class="label">Формула (1):</span>' +
      'H<sub>ч</sub> — визначені за положенням горизонталей на плані ділянки</div>';
    html += '<table class="data-table"><thead><tr><th></th>';
    for (let cc = 0; cc < cols; cc++) html += `<th>Стовп. ${cc + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += `<tr><td><strong>Ряд ${r + 1}</strong></td>`;
      for (let cc = 0; cc < cols; cc++) {
        const idx = r * cols + cc;
        html += `<td class="highlight">${inp.blackMarks[idx].toFixed(2)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    c.innerHTML = html;
  }

  function renderStep2(parent, blackMarks, Hser, cols, rows) {
    const c = makeStep(parent, 2, 'Середня планувальна відмітка');
    const classification = Calc.classifyVertices(cols, rows);
    let sumH1 = 0, sumH2 = 0, sumH4 = 0;
    let h1List = [], h2List = [], h4List = [];
    for (let i = 0; i < blackMarks.length; i++) {
      const k = classification[i];
      if (k === 1) { sumH1 += blackMarks[i]; h1List.push(blackMarks[i].toFixed(2)); }
      else if (k === 2) { sumH2 += blackMarks[i]; h2List.push(blackMarks[i].toFixed(2)); }
      else if (k === 4) { sumH4 += blackMarks[i]; h4List.push(blackMarks[i].toFixed(2)); }
    }
    const n = (cols - 1) * (rows - 1);
    let html = '<div class="formula-block"><span class="label">Формула (2):</span>' +
      'H<sub>сер</sub> = (ΣH<sub>1</sub> + 2·ΣH<sub>2</sub> + 4·ΣH<sub>4</sub>) / (4·n)</div>';
    html += '<div class="formula-sub">' +
      `ΣH₁ (${h1List.length} верш.) = ${h1List.join(' + ')} = ${sumH1.toFixed(2)}\n` +
      `ΣH₂ (${h2List.length} верш.) = ${h2List.join(' + ')} = ${sumH2.toFixed(2)}\n` +
      `ΣH₄ (${h4List.length} верш.) = ${h4List.join(' + ')} = ${sumH4.toFixed(2)}\n` +
      `n = ${n}\n\n` +
      `H_сер = (${sumH1.toFixed(2)} + 2·${sumH2.toFixed(2)} + 4·${sumH4.toFixed(2)}) / (4·${n})\n` +
      `H_сер = (${sumH1.toFixed(2)} + ${(2 * sumH2).toFixed(2)} + ${(4 * sumH4).toFixed(2)}) / ${4 * n}\n` +
      `H_сер = ${(sumH1 + 2 * sumH2 + 4 * sumH4).toFixed(2)} / ${4 * n}</div>`;
    html += `<p class="formula-result">H<sub>сер</sub> = ${Hser.toFixed(3)} м</p>`;
    c.innerHTML = html;
  }

  function renderStep3(parent, redMarks, Hser, inp, cols, rows) {
    const c = makeStep(parent, 3, 'Червоні (проектні) відмітки');
    const midC = (cols - 1) / 2;
    const midR = (rows - 1) / 2;
    let html = '<div class="formula-block"><span class="label">Формула (4):</span>' +
      'H<sub>черв</sub> = H<sub>сер</sub> ± L<sub>1</sub>·i<sub>1</sub>/2 ± L<sub>2</sub>·i<sub>2</sub>/2</div>';
    html += `<p>H<sub>сер</sub> = ${Hser.toFixed(3)} м, i<sub>1</sub> = ${inp.i1}, i<sub>2</sub> = ${inp.i2}</p>`;
    html += '<table class="data-table"><thead><tr><th>Вершина</th><th>dx, м</th><th>dy, м</th><th>H<sub>черв</sub>, м</th></tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const idx = r * cols + cc;
        const dx = (cc - midC) * state.squareA;
        const dy = (r - midR) * state.squareB;
        html += `<tr><td>${r + 1}-${cc + 1}</td><td>${dx.toFixed(0)}</td><td>${dy.toFixed(0)}</td>` +
          `<td class="highlight">${redMarks[idx].toFixed(3)}</td></tr>`;
      }
    }
    html += '</tbody></table>';
    c.innerHTML = html;
  }

  function renderStep4(parent, blackMarks, redMarks, workingMarks, cols, rows) {
    const c = makeStep(parent, 4, 'Робочі відмітки');
    let html = '<div class="formula-block"><span class="label">Формула (5):</span>' +
      'h = H<sub>черв</sub> − H<sub>ч</sub></div>';
    html += '<table class="data-table"><thead><tr><th>Вершина</th><th>H<sub>ч</sub> (чорна), м</th>' +
      '<th>H<sub>черв</sub> (червона), м</th><th>h (робоча), м</th><th>Тип</th></tr></thead><tbody>';
    for (let i = 0; i < cols * rows; i++) {
      const r = Math.floor(i / cols), cc = i % cols;
      const wm = workingMarks[i];
      const cls = wm >= 0 ? 'positive' : 'negative';
      const type = wm >= 0 ? 'насип' : 'виїмка';
      html += `<tr><td>${r + 1}-${cc + 1}</td><td>${blackMarks[i].toFixed(3)}</td>` +
        `<td>${redMarks[i].toFixed(3)}</td><td class="${cls}">${wm >= 0 ? '+' : ''}${wm.toFixed(3)}</td>` +
        `<td>${type}</td></tr>`;
    }
    html += '</tbody></table>';
    c.innerHTML = html;
  }

  function renderStep5(parent, zeroPoints, squareA, squareB) {
    const c = makeStep(parent, 5, 'Лінія нульових робіт');
    let html = '<p>Нульові точки визначаються інтерполяцією між вершинами з різними знаками робочих відміток.</p>';
    if (zeroPoints.length === 0) {
      html += '<div class="note-box">Нульових точок не знайдено — весь майданчик одного типу.</div>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Точка</th><th>x, м</th><th>y, м</th></tr></thead><tbody>';
      zeroPoints.forEach((p, i) => {
        html += `<tr><td>${i + 1}</td><td>${p.x.toFixed(1)}</td><td>${p.y.toFixed(1)}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    c.innerHTML = html;
  }

  function renderStep6(parent, volData, balance, soil) {
    const c = makeStep(parent, 6, 'Об\'єми ґрунту (метод квадратних призм)');
    let html = '<div class="formula-block"><span class="label">Формула (6) — повний квадрат:</span>' +
      'V = a² · (h₁+h₂+h₃+h₄) / 4</div>';
    html += '<div class="formula-block"><span class="label">Формула (7) — перехідний квадрат:</span>' +
      'V<sub>н(в)</sub> = a² · (Σh<sub>н(в)</sub>)² / (4 · Σ|h|)</div>';
    html += '<table class="data-table"><thead><tr><th>№ кв.</th><th>h₁</th><th>h₂</th><th>h₃</th><th>h₄</th>' +
      '<th>Σ|h|</th><th>Насип, м³</th><th>Виїмка, м³</th></tr></thead><tbody>';
    for (const sq of volData.squares) {
      html += `<tr><td>${sq.num}</td>`;
      [sq.h1, sq.h2, sq.h3, sq.h4].forEach(h => {
        html += `<td class="${h >= 0 ? 'positive' : 'negative'}">${h >= 0 ? '+' : ''}${h.toFixed(3)}</td>`;
      });
      html += `<td>${sq.sumAbsH.toFixed(3)}</td>`;
      html += `<td>${sq.fill > 0 ? sq.fill.toFixed(2) : '—'}</td>`;
      html += `<td>${sq.cut > 0 ? sq.cut.toFixed(2) : '—'}</td></tr>`;
    }
    html += `<tr class="total-row"><td colspan="6">Σ Об'єм робіт</td>` +
      `<td>${volData.totalFill.toFixed(2)}</td><td>${volData.totalCut.toFixed(2)}</td></tr>`;
    html += '</tbody></table>';

    const loosePct = ((soil.kResidual - 1) * 100).toFixed(1);
    html += `<p>Коефіцієнт залишкового розпушення (${soil.name}): ${loosePct}%</p>`;
    html += '<div class="formula-sub">' +
      `Об'єм розпушування = ${volData.totalCut.toFixed(2)} × ${loosePct}% = ${(volData.totalCut * (soil.kResidual - 1)).toFixed(2)} м³\n` +
      `Виїмка з розпушуванням = ${balance.loosened.toFixed(2)} м³\n` +
      `Похибка = |${volData.totalFill.toFixed(2)} − ${balance.loosened.toFixed(2)}| / ${balance.maxVol.toFixed(2)} × 100% = ${balance.error.toFixed(2)}%</div>`;

    if (balance.ok) {
      html += `<div class="success-box">Похибка ${balance.error.toFixed(2)}% &le; 5% — баланс прийнятний. Максимальний об'єм: ${balance.maxVol.toFixed(2)} м³</div>`;
    } else {
      html += `<div class="note-box">Похибка ${balance.error.toFixed(2)}% &gt; 5% — потрібне коригування!</div>`;
    }
    c.innerHTML = html;
  }

  function renderSiteDiagram(parent, data) {
    const sec = document.createElement('div');
    sec.className = 'step-section open';
    sec.innerHTML = `<div class="step-header">
      <span class="step-number">&#9776;</span>
      <span class="step-title">Схема майданчика з відмітками та лінією нульових робіт</span>
      <span class="step-toggle">&#9660;</span>
    </div><div class="step-body"><div class="step-content"><div class="diagram-container" id="siteDiagram"></div></div></div>`;
    parent.appendChild(sec);
    sec.querySelector('.step-header').onclick = () => sec.classList.toggle('open');
    setTimeout(() => Diagram.drawSitePlan('siteDiagram', data), 50);
  }

  function renderStep7(parent, carto, volData, workingMarks, zeroPoints, cols, rows, squareA, squareB) {
    const c = makeStep(parent, 7, 'Картограма земляних мас та середня відстань переміщення');
    let html = '<p>Побудовано криві об\'ємів насипу і виїмки з наростаючою сумою. ' +
      'Центри ваги зон виїмки (M) та насипу (N) визначені графічно.</p>';
    html += `<p class="formula-result">L<sub>ср</sub> = ${carto.Lsr.toFixed(1)} м</p>`;
    html += '<div class="formula-sub">' +
      `Центр ваги виїмки (M): x=${carto.cxCut.toFixed(1)} м, y=${carto.cyCut.toFixed(1)} м\n` +
      `Центр ваги насипу (N): x=${carto.cxFill.toFixed(1)} м, y=${carto.cyFill.toFixed(1)} м\n` +
      `Lср = √((${carto.cxCut.toFixed(1)}−${carto.cxFill.toFixed(1)})² + (${carto.cyCut.toFixed(1)}−${carto.cyFill.toFixed(1)})²) = ${carto.Lsr.toFixed(1)} м</div>`;
    html += '<div class="diagram-container" id="cartogramDiagram"></div>';
    c.innerHTML = html;
    setTimeout(() => Diagram.drawCartogram('cartogramDiagram', {
      carto, volData, workingMarks, zeroPoints, cols, rows, squareA, squareB
    }), 50);
  }

  function renderStep8(parent, processes) {
    const c = makeStep(parent, 8, 'Структура процесу вертикального планування');
    let html = '<table class="data-table"><thead><tr><th>№</th><th>Назва робіт</th><th>Од. вим.</th><th>Об\'єм</th></tr></thead><tbody>';
    processes.forEach((p, i) => {
      html += `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.unit}</td><td class="highlight">${p.volume.toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table>';
    c.innerHTML = html;
  }

  function renderSteps9to11(parent, suggestions, processes, volData, carto, inp, maxVol) {
    const ranked = pickBestMachineVariants(suggestions, processes, carto, inp, maxVol);
    const top1 = ranked.primary;
    const top2 = ranked.alternative;
    const modeLabel = inp.calcMode === 'normative' ? 'нормативним режимом ЕН' : 'експлуатаційним режимом';

    const c9 = makeStep(parent, 9, 'Попередній вибір ведучих машин');
    let h9 = `<p>Об'єм робіт: ${(maxVol / 1000).toFixed(2)} тис. м3. Середня відстань переміщення: ${carto.Lsr.toFixed(1)} м.</p>`;
    h9 += `<p>Варіанти автоматично ранжовані за табл. 8 методичних вказівок, відстанню переміщення та показниками, розрахованими за ${modeLabel}.</p>`;
    h9 += `<h3 style="margin-top:12px;color:var(--primary)">Варіант 1: ${formatLeadTypeLabel(top1.leadMachine)}</h3>`;
    h9 += machineInfoHtml(top1.leadMachine);
    h9 += `<p>${buildSelectionRationale(top1, carto.Lsr)}</p>`;
    h9 += `<h3 style="margin-top:12px;color:var(--primary)">Варіант 2: ${formatLeadTypeLabel(top2.leadMachine)}</h3>`;
    h9 += machineInfoHtml(top2.leadMachine);
    h9 += `<p>${buildSelectionRationale(top2, carto.Lsr)}</p>`;
    c9.innerHTML = h9;

    const c10 = makeStep(parent, 10, 'Комплекти машин');
    let h10 = '<table class="data-table"><thead><tr><th>№</th><th>Назва процесу</th><th>Комплект 1</th><th>Комплект 2</th></tr></thead><tbody>';
    for (let i = 0; i < processes.length; i++) {
      h10 += `<tr><td>${i + 1}</td><td>${processes[i].name}</td>` +
        `<td>${formatMachineSetCell(top1.set[i].machine, top1.tep.machineCounts[i])}</td>` +
        `<td>${formatMachineSetCell(top2.set[i].machine, top2.tep.machineCounts[i])}</td></tr>`;
    }
    h10 += '</tbody></table>';
    c10.innerHTML = h10;

    const c11 = makeStep(parent, 11, 'Техніко-економічні показники (ТЕП)');
    let h11 = '<h3 style="color:var(--primary)">Варіант 1</h3>';
    h11 += tepTableHtmlLogical(top1.tep, processes, top1.set, inp);
    h11 += '<h3 style="color:var(--primary);margin-top:16px">Варіант 2</h3>';
    h11 += tepTableHtmlLogical(top2.tep, processes, top2.set, inp);
    h11 += '<h3 style="margin-top:16px;color:var(--primary)">Порівняльна таблиця</h3>';
    h11 += '<table class="data-table"><thead><tr><th>Показник</th><th>Комплект 1</th><th>Комплект 2</th></tr></thead><tbody>';
    h11 += `<tr><td>Тривалість, днів</td><td>${top1.tep.totalDuration.toFixed(2)}</td><td>${top2.tep.totalDuration.toFixed(2)}</td></tr>`;
    h11 += `<tr><td>Трудомісткість, люд-год/м3</td><td>${top1.tep.labourIntensity.toFixed(4)}</td><td>${top2.tep.labourIntensity.toFixed(4)}</td></tr>`;
    h11 += `<tr><td>Собівартість C0, грн</td><td>${top1.tep.totalCost.toFixed(2)}</td><td>${top2.tep.totalCost.toFixed(2)}</td></tr>`;
    h11 += `<tr><td>Приведені витрати, грн/м3</td><td>${top1.tep.reducedCosts.toFixed(4)}</td><td>${top2.tep.reducedCosts.toFixed(4)}</td></tr>`;
    h11 += `<tr><td>Логічний штраф</td><td>${top1.logicPenalty.toFixed(2)}</td><td>${top2.logicPenalty.toFixed(2)}</td></tr>`;
    h11 += '</tbody></table>';
    h11 += `<div class="success-box">Обрано <strong>Комплект 1</strong>: він краще відповідає методичній області застосування та має кращу сумарну оцінку.</div>`;
    c11.innerHTML = h11;

    return { winner: 1, tep: top1.tep, set: top1.set, processes, maxVol, Lsr: carto.Lsr };
  }

  function formatNumber(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : '—';
  }

  function formatLeadTypeLabel(machine) {
    if (!machine) return 'Машина не визначена';
    if (machine.type === 'scraper') return 'Скрепер';
    if (machine.type === 'loader') return 'Навантажувач';
    return 'Бульдозер';
  }

  function formatMachineSetCell(machine, count) {
    if (!machine) return '—';
    return count > 1 ? `${machine.name} × ${count}` : machine.name;
  }

  function buildSelectionRationale(variant, Lsr) {
    const machine = variant.leadMachine;
    if (!machine) return 'Варіант без визначеної ведучої машини.';
    if (machine.type === 'bulldozer') {
      return `Доцільний для переміщення ґрунту на ${Lsr.toFixed(1)} м при відносно короткому плечі транспортування.`;
    }
    if (machine.type === 'scraper') {
      return `Доцільний для суміщення розроблення, транспортування та часткового розрівнювання на плечі ${Lsr.toFixed(1)} м.`;
    }
    return `Навантажувач залишено як альтернативу для механізованого комплекту при складніших локальних операціях.`;
  }

  function getProcessExecutionData(process, index, inp, machine) {
    if (inp.calcMode === 'production') {
      return getProductionExecutionData(process, index, inp, machine);
    }
    return getNormativeExecutionData(process, index, inp, machine);
  }

  function getProductionExecutionData(process, index, inp, machine) {
    const isAreaProcess = index === 0 || index === 5;
    const layerThickness = inp.topsoil || 0.2;
    const calcVolume = isAreaProcess ? process.volume * layerThickness : process.volume;
    const calcUnit = isAreaProcess ? 'м3' : process.unit;

    return {
      mode: 'production',
      norm: null,
      isAreaProcess,
      mainVolume: process.volume,
      mainUnit: process.unit,
      calcVolume,
      calcUnit,
      sourceLabel: `${formatNumber(process.volume)} ${process.unit}`,
      calcLabel: `${formatNumber(calcVolume)} ${calcUnit}`,
      normUnitLabel: '—',
      normUnits: null,
      machineDays: null,
      laborDays: null,
      machineDayNorm: null,
      laborDayNorm: null,
      enCode: '—',
      crewLabel: machine ? `${machine.workers || 1} маш.` : '—'
    };
  }

  function getNormativeExecutionData(process, index, inp, machine) {
    const norm = ENNorms.getByProcessId(process.id);
    if (!norm) {
      return getProductionExecutionData(process, index, inp, machine);
    }

    const machineType = machine?.type || 'bulldozer';
    const machineDayNorm = getMachineSpecificNorm(norm, machineType, 'machineDay');
    const laborDayNorm = getMachineSpecificNorm(norm, machineType, 'laborDay');
    const normUnits = process.volume / norm.unitSize;
    const machineDays = normUnits * machineDayNorm;
    const laborDays = normUnits * laborDayNorm;
    const crewCount = Math.max(machine?.workers || 1, Math.ceil(laborDayNorm / Math.max(machineDayNorm, 0.01)));

    return {
      mode: 'normative',
      norm,
      isAreaProcess: norm.unitBase === 'м²',
      mainVolume: process.volume,
      mainUnit: process.unit,
      calcVolume: process.volume,
      calcUnit: process.unit,
      sourceLabel: `${formatNumber(process.volume)} ${process.unit}`,
      calcLabel: `${formatNumber(process.volume)} ${process.unit}`,
      normUnitLabel: `${norm.unitSize} ${norm.unitBase}`,
      normUnits,
      machineDays,
      laborDays,
      machineDayNorm,
      laborDayNorm,
      enCode: norm.enCode || 'ЕН',
      crewLabel: `${crewCount} роб. у зміну`
    };
  }

  function getMachineSpecificNorm(norm, machineType, fieldPrefix) {
    const mapName = fieldPrefix === 'machineDay' ? 'machineDayByType' : 'laborDayByType';
    const baseName = fieldPrefix === 'machineDay' ? 'machineDayNorm' : 'laborDayNorm';
    return norm[mapName]?.[machineType] ?? norm[baseName];
  }

  function computeProductionBaseDuration(machine, procData, Lsr, tShift, index) {
    const vol = procData.calcVolume;
    const isLocalOperation = procData.isAreaProcess || index === 1 || index === 3;
    const workDistance = isLocalOperation ? 30 : Lsr;

    if (!machine) return 0;
    if (machine.type === 'bulldozer') {
      return vol / Calc.bulldozerProductivity(machine, workDistance, tShift).Pe;
    }
    if (machine.type === 'scraper') {
      return vol / Calc.scraperProductivity(machine, Lsr, tShift).Pe;
    }
    if (machine.type === 'loader') {
      return vol / Calc.loaderProductivity(machine, workDistance, tShift).Pe;
    }
    if (machine.type === 'compactor') {
      return vol / (machine.productivityPerShift || 1000);
    }
    return vol / 500;
  }

  function targetScheduleDays(maxVol, Lsr) {
    const volumeThousand = maxVol / 1000;
    return Math.max(18, Math.min(45, 12 + 1.5 * volumeThousand + 0.03 * Lsr));
  }

  function maxMachinesForProcess(machine, processIndex) {
    if (!machine) return 1;
    if (machine.type === 'scraper') return 4;
    if (machine.type === 'loader') return 4;
    if (machine.type === 'compactor') return 3;
    if (machine.type === 'bulldozer') {
      if (processIndex === 2) return 4;
      if (processIndex === 1) return 2;
      return 3;
    }
    return 2;
  }

  function optimizeMachineCounts(baseDurations, machines, numShifts, maxVol, Lsr) {
    const counts = baseDurations.map(dur => dur > 0 ? 1 : 0);
    const targetDays = targetScheduleDays(maxVol, Lsr);

    function score(currentCounts) {
      const totalDays = baseDurations.reduce((sum, dur, idx) => {
        if (!dur || !machines[idx]) return sum;
        return sum + dur / Math.max(currentCounts[idx], 1) / Math.max(numShifts, 1);
      }, 0);
      const overrun = Math.max(0, totalDays - targetDays);
      const extraMachinesPenalty = currentCounts.reduce((sum, count, idx) => {
        const machine = machines[idx];
        if (!machine || count <= 1) return sum;
        return sum + (count - 1) * (1 + (machine.price || 0) / 250);
      }, 0);
      return Math.abs(totalDays - targetDays) * 20 + overrun * 10 + extraMachinesPenalty * 3;
    }

    let bestScore = score(counts);
    let improved = true;
    while (improved) {
      improved = false;
      let bestIdx = -1;
      let candidateBest = bestScore;
      for (let i = 0; i < counts.length; i++) {
        if (!machines[i]) continue;
        if (counts[i] >= maxMachinesForProcess(machines[i], i)) continue;
        if (baseDurations[i] / Math.max(counts[i], 1) < 2.5) continue;
        const trial = [...counts];
        trial[i] += 1;
        const trialScore = score(trial);
        if (trialScore + 1e-6 < candidateBest) {
          candidateBest = trialScore;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        counts[bestIdx] += 1;
        bestScore = candidateBest;
        improved = true;
      }
    }

    return counts.map((count, idx) => (machines[idx] ? Math.max(count, 1) : 0));
  }

  function computeTEP(set, processes, leadMachine, compactor, Lsr, tShift, maxVol, inp) {
    const baseDurations = [];
    const executionData = [];
    const machines = set.map(item => item.machine);
    const isNormative = inp.calcMode !== 'production';

    for (let i = 0; i < processes.length; i++) {
      const procData = getProcessExecutionData(processes[i], i, inp, machines[i]);
      executionData.push(procData);
      const baseDuration = isNormative
        ? procData.machineDays || 0
        : computeProductionBaseDuration(machines[i], procData, Lsr, tShift, i);
      baseDurations.push(Number.isFinite(baseDuration) && baseDuration > 0 ? baseDuration : 0);
    }

    const machineCounts = optimizeMachineCounts(baseDurations, machines, inp.numShifts || 1, maxVol, Lsr);
    const durations = [];
    const machineHourCosts = [];
    const wages = [];
    const machinesUsed = [];
    let sumMachineCost = 0;
    let totalLabourHours = 0;

    for (let i = 0; i < processes.length; i++) {
      const machine = machines[i];
      const count = Math.max(machineCounts[i], 1);
      const procData = executionData[i];
      let durationDays = 0;
      let machineHoursPerMachine = 0;
      let labourHours = 0;

      if (machine && baseDurations[i] > 0) {
        if (isNormative) {
          durationDays = (procData.machineDays || 0) / (count * Math.max(inp.numShifts || 1, 1));
          machineHoursPerMachine = ((procData.machineDays || 0) / count) * tShift;
          labourHours = (procData.laborDays || 0) * tShift;
        } else {
          const durationShifts = baseDurations[i] / count;
          durationDays = durationShifts / Math.max(inp.numShifts || 1, 1);
          machineHoursPerMachine = durationShifts * tShift;
          labourHours = durationShifts * count * tShift * (machine.workers || 1);
        }
      }

      durations.push(durationDays);

      if (machine && machineHoursPerMachine > 0) {
        const Cmh = Calc.machineHourCost(machine.oneTime || 0, machineHoursPerMachine, machine.price, machine.amort, machine.yearHours, machine.Ce);
        machineHourCosts.push(Cmh);
        wages.push(labourHours * 30);
        totalLabourHours += labourHours;
        sumMachineCost += count * Cmh * machineHoursPerMachine;
        for (let k = 0; k < count; k++) machinesUsed.push(machine);
      } else {
        machineHourCosts.push(0);
        wages.push(0);
      }
    }

    const totalDuration = durations.reduce((sum, value) => sum + value, 0);
    const totalCost = 1.08 * sumMachineCost + 1.5 * wages.reduce((sum, value) => sum + value, 0);
    const reducedCosts = maxVol > 0
      ? (totalCost + 0.12 * machines.reduce((sum, machine, index) => {
        if (!machine) return sum;
        const count = machineCounts[index];
        const machineHours = isNormative
          ? ((executionData[index].machineDays || 0) / Math.max(count, 1)) * tShift
          : (baseDurations[index] / Math.max(count, 1)) * tShift;
        return sum + count * (machine.price * 1000) * machineHours / Math.max(machine.yearHours, 1);
      }, 0)) / maxVol
      : 0;

    return {
      mode: inp.calcMode,
      executionData,
      machineCounts,
      baseDurations,
      durations,
      machineHourCosts,
      wages,
      machinesUsed,
      totalDuration,
      labourIntensity: maxVol > 0 ? totalLabourHours / maxVol : 0,
      totalCost,
      reducedCosts
    };
  }

  function tepTableHtmlLogical(tep, processes, set, inp) {
    if (tep.mode === 'production') {
      let html = '<table class="data-table"><thead><tr><th>Процес</th><th>Машина</th><th>Розрах. об\'єм</th><th>К-сть машин</th><th>Тривалість, днів</th><th>С<sub>маш.год</sub>, грн</th></tr></thead><tbody>';
      for (let i = 0; i < processes.length; i++) {
        const machine = set[i].machine;
        const procData = tep.executionData[i];
        html += `<tr><td>${processes[i].name}</td><td>${formatMachineSetCell(machine, tep.machineCounts[i])}</td>` +
          `<td>${procData.calcLabel}</td><td>${tep.machineCounts[i] || '—'}</td><td>${formatNumber(tep.durations[i])}</td><td>${formatNumber(tep.machineHourCosts[i])}</td></tr>`;
      }
      html += `<tr class="total-row"><td colspan="4">Разом</td><td>${formatNumber(tep.totalDuration)}</td><td>—</td></tr>`;
      html += '</tbody></table>';
      return html;
    }

    let html = '<table class="data-table"><thead><tr><th>Процес</th><th>Основний об\'єм</th><th>Нормативна одиниця</th><th>К-сть нормо-од.</th><th>днмаш</th><th>днлюд</th><th>Машина</th><th>К-сть машин</th><th>Тривалість, днів</th></tr></thead><tbody>';
    for (let i = 0; i < processes.length; i++) {
      const machine = set[i].machine;
      const procData = tep.executionData[i];
      html += `<tr><td>${processes[i].name}</td><td>${procData.sourceLabel}</td><td>${procData.normUnitLabel}</td>` +
        `<td>${formatNumber(procData.normUnits, 3)}</td><td>${formatNumber(procData.machineDays, 2)}</td><td>${formatNumber(procData.laborDays, 2)}</td>` +
        `<td>${formatMachineSetCell(machine, tep.machineCounts[i])}</td><td>${tep.machineCounts[i] || '—'}</td><td>${formatNumber(tep.durations[i])}</td></tr>`;
    }
    html += `<tr class="total-row"><td colspan="8">Разом</td><td>${formatNumber(tep.totalDuration)}</td></tr>`;
    html += '</tbody></table>';
    return html;
  }

  function renderStep12Logical(parent, tepResults, inp) {
    const c = makeStep(parent, 12, 'Калькуляція трудових витрат');
    const { tep, set, processes } = tepResults;

    if (tep.mode === 'production') {
      let html = '<div class="note-box">Для експлуатаційного режиму калькуляція показана у спрощеному вигляді. Для курсової рекомендовано використовувати нормативний режим ЕН.</div>';
      html += '<table class="data-table"><thead><tr><th>№</th><th>Процес</th><th>Об\'єм</th><th>Машина</th><th>Трудомісткість, люд-год</th><th>Зарплата, грн</th></tr></thead><tbody>';
      let totalLabour = 0;
      let totalWage = 0;
      for (let i = 0; i < processes.length; i++) {
        const machine = set[i].machine;
        const labour = tep.wages[i] / 30;
        totalLabour += labour;
        totalWage += tep.wages[i];
        html += `<tr><td>${i + 1}</td><td>${processes[i].name}</td><td>${tep.executionData[i].calcLabel}</td><td>${formatMachineSetCell(machine, tep.machineCounts[i])}</td>` +
          `<td>${formatNumber(labour)}</td><td>${formatNumber(tep.wages[i])}</td></tr>`;
      }
      html += `<tr class="total-row"><td colspan="4">Разом</td><td>${formatNumber(totalLabour)}</td><td>${formatNumber(totalWage)}</td></tr>`;
      html += '</tbody></table>';
      c.innerHTML = html;
      return;
    }

    let html = '<table class="data-table"><thead><tr><th>№</th><th>Пункт ЕН</th><th>Назва процесу</th><th>Об\'єм робіт</th><th>Нормативна одиниця</th><th>Норма часу, днмаш</th><th>Норма часу, днлюд</th><th>Трудомісткість, днмаш</th><th>Трудомісткість, днлюд</th><th>Сума зарплати, грн</th><th>Склад ланки</th></tr></thead><tbody>';
    let totalMachineDays = 0;
    let totalLabourDays = 0;
    let totalWage = 0;
    const sourceLines = [];

    for (let i = 0; i < processes.length; i++) {
      const procData = tep.executionData[i];
      totalMachineDays += procData.machineDays || 0;
      totalLabourDays += procData.laborDays || 0;
      totalWage += tep.wages[i];
      if (procData.norm?.source) {
        sourceLines.push(`${procData.enCode} — ${procData.norm.source}`);
      }
      html += `<tr><td>${i + 1}</td><td>${procData.enCode}</td><td>${processes[i].name}</td><td>${procData.sourceLabel}</td>` +
        `<td>${procData.normUnitLabel}</td><td>${formatNumber(procData.machineDayNorm, 3)}</td><td>${formatNumber(procData.laborDayNorm, 3)}</td>` +
        `<td>${formatNumber(procData.machineDays, 2)}</td><td>${formatNumber(procData.laborDays, 2)}</td><td>${formatNumber(tep.wages[i])}</td><td>${procData.crewLabel}</td></tr>`;
    }

    html += `<tr class="total-row"><td colspan="7">Разом</td><td>${formatNumber(totalMachineDays)}</td><td>${formatNumber(totalLabourDays)}</td><td>${formatNumber(totalWage)}</td><td>—</td></tr>`;
    html += '</tbody></table>';
    if (sourceLines.length) {
      html += `<div class="formula-sub" style="margin-top:12px">${[...new Set(sourceLines)].join('<br>')}</div>`;
    }
    c.innerHTML = html;
  }

  function renderStep13Logical(parent, tepResults, inp) {
    const c = makeStep(parent, 13, 'Календарний графік виконання робіт');
    const { tep, set, processes } = tepResults;
    const numShifts = Math.max(inp.numShifts || 1, 1);
    const schedData = [];
    let tableHtml = '<table class="data-table"><thead><tr><th>№</th><th>Процес</th><th>Машина</th><th>К-сть машин</th><th>днмаш</th><th>днлюд</th><th>Змін/добу</th><th>Тривалість, днів</th></tr></thead><tbody>';

    for (let i = 0; i < processes.length; i++) {
      const durationDays = tep.durations[i];
      if (!durationDays || durationDays <= 0) continue;
      const machine = set[i].machine;
      const procData = tep.executionData[i];
      const machineCount = tep.machineCounts[i] || 1;
      const workersPerShift = tep.mode === 'normative'
        ? Math.max(machineCount * (machine?.workers || 1), Math.ceil((procData.laborDays || 0) / Math.max(durationDays * numShifts, 0.1)))
        : Math.max(1, machineCount * (machine?.workers || 1));

      tableHtml += `<tr><td>${i + 1}</td><td>${processes[i].name}</td><td>${formatMachineSetCell(machine, machineCount)}</td><td>${machineCount}</td>` +
        `<td>${tep.mode === 'normative' ? formatNumber(procData.machineDays) : '—'}</td><td>${tep.mode === 'normative' ? formatNumber(procData.laborDays) : '—'}</td>` +
        `<td>${numShifts}</td><td>${formatNumber(durationDays)}</td></tr>`;

      schedData.push({
        name: processes[i].name,
        duration: durationDays * numShifts,
        durationLabel: `${formatNumber(durationDays)} дн.`,
        workers: workersPerShift,
        shifts: numShifts,
        machine: formatMachineSetCell(machine, machineCount),
        volumeStr: tep.mode === 'normative' ? `${formatNumber(procData.normUnits, 2)} норм.` : procData.calcLabel
      });
    }

    tableHtml += '</tbody></table>';
    c.innerHTML = `${tableHtml}<div class="diagram-container" id="scheduleDiagram"></div>`;
    setTimeout(() => Schedule.drawSchedule('scheduleDiagram', schedData), 50);
  }

  function getMethodologyBand(volumeThousand) {

    if (volumeThousand <= 1.5) {
      return {
        bulldozerPower: [20, 60],
        scraperBucket: [0, 3],
        loaderBucket: [0.2, 0.6]
      };
    }
    if (volumeThousand <= 20) {
      return {
        bulldozerPower: [60, 90],
        scraperBucket: [4, 8],
        loaderBucket: [0.7, 1.5]
      };
    }
    if (volumeThousand <= 50) {
      return {
        bulldozerPower: [90, 160],
        scraperBucket: [9, 18],
        loaderBucket: [1.6, 2.5]
      };
    }
    if (volumeThousand <= 100) {
      return {
        bulldozerPower: [160, 220],
        scraperBucket: [20, 30],
        loaderBucket: [2.6, 4]
      };
    }
    return {
      bulldozerPower: [220, 440],
      scraperBucket: [30, 40],
      loaderBucket: [4, Infinity]
    };
  }

  function rangePenalty(value, [min, max]) {
    if (value >= min && value <= max) return 0;
    if (value < min) return (min - value) / Math.max(min, 1);
    if (!isFinite(max)) return 0;
    return (value - max) / Math.max(max, 1);
  }

  function distancePenalty(machine, Lsr) {
    if (machine.type === 'bulldozer') {
      if (Lsr <= 70) return 0;
      if (Lsr <= 100) return 0.5;
      if (Lsr <= 150 && (machine.power || 0) >= 200) return 1.0;
      return 4 + Math.max(0, (Lsr - 100) / 50);
    }
    if (machine.type === 'scraper') {
      if (Lsr < 80) return 1.0;
      if (Lsr <= 300) return 0;
      if ((machine.bucketVolume || 0) <= 5 && Lsr <= 400) return 0.7;
      if ((machine.bucketVolume || 0) <= 10 && Lsr <= 750) return 0.2;
      if ((machine.bucketVolume || 0) <= 15 && Lsr <= 1000) return 0.2;
      return 3 + Math.max(0, (Lsr - 750) / 250);
    }
    if (machine.type === 'loader') {
      if (Lsr <= 40) return 0.3;
      if (Lsr <= 80) return 1.2;
      return 4 + Math.max(0, (Lsr - 80) / 40);
    }
    return 0;
  }

  function methodologyPenalty(machine, maxVol, Lsr) {
    const band = getMethodologyBand(maxVol / 1000);
    let penalty = distancePenalty(machine, Lsr);
    if (machine.type === 'bulldozer') penalty += 2 * rangePenalty(machine.power || 0, band.bulldozerPower);
    if (machine.type === 'scraper') penalty += 2 * rangePenalty(machine.bucketVolume || 0, band.scraperBucket);
    if (machine.type === 'loader') penalty += 2 * rangePenalty(machine.bucketVolume || 0, band.loaderBucket);
    return penalty;
  }

  function pickPreferredMachine(machineIds, fallbackList, fallbackMachine) {
    for (const machineId of machineIds || []) {
      const machine = Machines.getById(machineId);
      if (machine) return machine;
    }
    return fallbackList?.[0] || fallbackMachine || null;
  }

  function buildMachineSetForLead(leadMachine, suggestions, processes, maxVol, carto) {
    const helperBulldozer = suggestions.bulldozers[0] || Machines.bulldozers[0];
    const gradingBulldozer = pickPreferredMachine(
      ENNorms.getByProcessId('topsoil_cut')?.recommendedMachines,
      suggestions.bulldozers,
      helperBulldozer
    );
    const finalBulldozer = pickPreferredMachine(
      ENNorms.getByProcessId('final_grading')?.recommendedMachines,
      suggestions.bulldozers,
      gradingBulldozer
    );
    const spreadingBulldozer = pickPreferredMachine(
      ENNorms.getByProcessId('soil_spreading')?.recommendedMachines,
      suggestions.bulldozers,
      helperBulldozer
    );
    const ripperLoosening = Machines.suggestRipperBulldozer(maxVol, carto.Lsr, suggestions) || Machines.getById('dp15');
    const compactor = suggestions.compactors.length > 1 ? suggestions.compactors[1] : suggestions.compactors[0];

    if (leadMachine.type === 'scraper') {
      return [
        { process: processes[0].name, machine: gradingBulldozer },
        { process: processes[1].name, machine: ripperLoosening },
        { process: processes[2].name, machine: leadMachine },
        { process: processes[3].name, machine: spreadingBulldozer },
        { process: processes[4].name, machine: compactor },
        { process: processes[5].name, machine: finalBulldozer }
      ];
    }

    if (leadMachine.type === 'loader') {
      return [
        { process: processes[0].name, machine: gradingBulldozer },
        { process: processes[1].name, machine: ripperLoosening },
        { process: processes[2].name, machine: leadMachine },
        { process: processes[3].name, machine: spreadingBulldozer },
        { process: processes[4].name, machine: compactor },
        { process: processes[5].name, machine: finalBulldozer }
      ];
    }

    return [
      { process: processes[0].name, machine: gradingBulldozer },
      { process: processes[1].name, machine: ripperLoosening },
      { process: processes[2].name, machine: leadMachine },
      { process: processes[3].name, machine: spreadingBulldozer },
      { process: processes[4].name, machine: compactor },
      { process: processes[5].name, machine: finalBulldozer }
    ];
  }

  function evaluateLeadCandidate(leadMachine, suggestions, processes, carto, inp, maxVol) {
    const machineSet = buildMachineSetForLead(leadMachine, suggestions, processes, maxVol, carto);
    const compact = suggestions.compactors.length > 1 ? suggestions.compactors[1] : suggestions.compactors[0];
    const tep = computeTEP(machineSet, processes, leadMachine, compact, carto.Lsr, inp.tShift, maxVol, inp);
    const logicPenalty = methodologyPenalty(leadMachine, maxVol, carto.Lsr);
    const score = logicPenalty * 1000 + tep.reducedCosts * 100 + tep.totalDuration;

    return {
      leadMachine,
      leadType: leadMachine.type,
      set: machineSet,
      tep,
      logicPenalty,
      score
    };
  }

  function pickBestMachineVariants(suggestions, processes, carto, inp, maxVol) {
    const candidates = [
      ...(suggestions.bulldozers || []),
      ...(suggestions.scrapers || []),
      ...(suggestions.loaders || [])
    ];

    const uniqueCandidates = [];
    const seen = new Set();
    for (const candidate of candidates) {
      if (!candidate || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      uniqueCandidates.push(candidate);
    }

    const evaluated = uniqueCandidates
      .map(candidate => evaluateLeadCandidate(candidate, suggestions, processes, carto, inp, maxVol))
      .sort((a, b) => a.score - b.score);

    const primary = evaluated[0];
    const alternative = evaluated.find(v => v.leadType !== primary.leadType) || evaluated[1] || primary;
    return { primary, alternative, evaluated };
  }

  function machineInfoHtml(m) {
    if (!m) return '<p>—</p>';
    let html = `<div class="machine-card selected"><h4>${m.name}</h4>`;
    html += `<p>Потужність: ${m.power || '—'} кВт | `;
    if (m.type === 'bulldozer') {
      html += `Відвал: ${m.bladeLength}×${m.bladeHeight} м | Об'єм: ${m.volumeMoved} м³`;
    } else if (m.type === 'scraper') {
      html += `Ківш: ${m.bucketVolume} м³ | Ширина різ.: ${m.cutWidth} м`;
    } else if (m.type === 'loader') {
      html += `Ківш: ${m.bucketVolume} м³`;
    }
    html += `</p><p>Вартість: ${m.price} тис. грн | Амортизація: ${m.amort}% | Тр: ${m.yearHours} год/рік</p></div>`;
    return html;
  }

  // ===== Read black marks from the vertex table =====
  function readBlackMarksFromTable() {
    const n = state.cols * state.rows;
    const marks = [];
    for (let i = 0; i < n; i++) {
      const el = document.getElementById(`vDirect_${i}`);
      const v = el ? parseFloat(el.value) : NaN;
      marks.push(!isNaN(v) && v > 0 ? v : 270);
    }
    return marks;
  }

  // ===== Draw site preview + init contour editor =====
  let savedContourParams = null;

  function syncContourElevations() {
    if (typeof ContourEditor === 'undefined') return;
    const K = parseFloat(document.getElementById('paramK').value) || 269;
    const L = parseFloat(document.getElementById('paramL').value) || 270;
    const M = parseFloat(document.getElementById('paramM').value) || 271;
    const params = ContourEditor.getParams();
    if (!params) return;
    const map = { K, L, M };
    let changed = false;
    for (const p of params) {
      if (map[p.id] !== undefined && p.elevation !== map[p.id]) {
        p.elevation = map[p.id];
        p.label = `${p.id} = ${map[p.id]}`;
        changed = true;
      }
    }
    if (changed) {
      ContourEditor.setParams(params);
      savedContourParams = ContourEditor.getParams();
      liveUpdateBlackMarks();
    }
  }

  function drawPreview() {
    const blackMarks = readBlackMarksFromTable();
    if (!blackMarks || blackMarks.length === 0) return;

    const { cols, rows, squareA, squareB } = state;
    const W = (cols - 1) * squareA;
    const H = (rows - 1) * squareB;

    const svgInfo = Diagram.drawSitePreview('sitePreview', {
      cols, rows, squareA, squareB,
      blackMarks,
      i1: parseFloat(document.getElementById('paramI1').value) || 0,
      i2: parseFloat(document.getElementById('paramI2').value) || 0
    });

    if (svgInfo && typeof ContourEditor !== 'undefined') {
      // Apply K/L/M from inputs to saved params before init
      const K = parseFloat(document.getElementById('paramK').value) || 269;
      const L = parseFloat(document.getElementById('paramL').value) || 270;
      const M = parseFloat(document.getElementById('paramM').value) || 271;
      let initParams = savedContourParams || ContourEditor.getDefaults();
      const map = { K, L, M };
      for (const p of initParams) {
        if (map[p.id] !== undefined) {
          p.elevation = map[p.id];
          p.label = `${p.id} = ${map[p.id]}`;
        }
      }

      ContourEditor.init({
        svg: svgInfo.svg,
        scale: svgInfo.scale,
        gridW: W,
        gridH: H,
        contours: initParams,
        paramPanel: document.getElementById('contourParams'),
        onUpdate: (params) => {
          savedContourParams = params;
          liveUpdateBlackMarks();
        }
      });
      savedContourParams = ContourEditor.getParams();
      liveUpdateBlackMarks();
    }
  }

  // ===== Contour edit mode =====
  function toggleContourEdit() {
    if (!ContourEditor) return;
    const editing = !ContourEditor.isEditing();
    ContourEditor.setEditMode(editing);

    const btnEdit = document.getElementById('btnEditContours');
    const panel = document.getElementById('contourParams');
    panel.style.display = 'block';
    if (editing) {
      btnEdit.textContent = 'Готово (вийти з редагування)';
      btnEdit.style.background = '#e63946';
    } else {
      btnEdit.textContent = 'Редагувати горизонталі';
      btnEdit.style.background = '#457b9d';
    }
  }

  function resetContours() {
    savedContourParams = null;
    if (typeof ContourEditor !== 'undefined') {
      const defaults = ContourEditor.getDefaults();
      const K = parseFloat(document.getElementById('paramK').value) || 269;
      const L = parseFloat(document.getElementById('paramL').value) || 270;
      const M = parseFloat(document.getElementById('paramM').value) || 271;
      const map = { K, L, M };
      for (const p of defaults) {
        if (map[p.id] !== undefined) { p.elevation = map[p.id]; p.label = `${p.id} = ${map[p.id]}`; }
      }
      ContourEditor.setParams(defaults);
      savedContourParams = ContourEditor.getParams();
      liveUpdateBlackMarks();
    }
  }

  function importContours() {
    const json = prompt('Вставте JSON параметрів горизонталей:');
    if (!json) return;
    try {
      const params = JSON.parse(json);
      ContourEditor.setParams(params);
      savedContourParams = ContourEditor.getParams();
      liveUpdateBlackMarks();
    } catch (e) {
      alert('Помилка парсингу JSON: ' + e.message);
    }
  }

  // ===== Live black mark computation from contour positions =====
  function liveUpdateBlackMarks() {
    if (typeof ContourEditor === 'undefined') return;
    const { cols, rows, squareA, squareB } = state;
    const W = (cols - 1) * squareA;
    const H = (rows - 1) * squareB;
    const marks = ContourEditor.computeBlackMarks(W, H, cols, rows, squareA, squareB);
    if (!marks) return;

    for (let i = 0; i < marks.length; i++) {
      const input = document.getElementById(`vDirect_${i}`);
      if (input) input.value = marks[i].elev.toFixed(2);
      const label = document.querySelector(`.bmark-label[data-idx="${i}"]`);
      if (label) label.textContent = marks[i].elev.toFixed(2);
    }
  }

  // ===== Event bindings =====
  document.getElementById('btnCalculate').addEventListener('click', runCalculations);

  const btnPdf = document.getElementById('btnPreviewPdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      // Gather SVGs
      const resultsDiv = document.getElementById('results');
      const svgs = {};
      const allSvgs = resultsDiv.querySelectorAll('svg');
      if (allSvgs.length >= 3) {
        svgs.site = allSvgs[0].outerHTML;
        svgs.carto = allSvgs[1].outerHTML;
        svgs.sched = allSvgs[2].outerHTML;
      }
      window.geoData.svgs = svgs;

      try {
        localStorage.setItem('rawGeoData', JSON.stringify(window.geoData));
        window.open('preview.html', '_blank');
      } catch (e) {
        console.error(e);
        alert('Помилка збереження даних для прев\'ю. Можливо завеликий розмір.');
      }
    });
  }

  document.getElementById('btnEditContours').addEventListener('click', toggleContourEdit);
  document.getElementById('btnResetContours').addEventListener('click', resetContours);
  document.getElementById('btnImportContours').addEventListener('click', importContours);

  // K/L/M inputs → update contours + black marks live
  ['paramK', 'paramL', 'paramM'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      drawPreview();
    });
  });

  // Site dimension inputs → rebuild everything
  ['paramA', 'paramB', 'gridSide'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      buildVertexTable();
      setTimeout(drawPreview, 50);
    });
  });

  // Initialize
  buildVertexTable();
  setTimeout(drawPreview, 200);
});
