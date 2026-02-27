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

    const n = state.cols * state.rows;
    const blackMarks = [];
    for (let i = 0; i < n; i++) {
      const v = parseFloat(document.getElementById(`vDirect_${i}`)?.value);
      blackMarks.push(!isNaN(v) && v > 0 ? v : 270);
    }

    return { A, B, i1, i2, topsoil, soil, tShift, numShifts, blackMarks };
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
    renderStep12(results, tepResults);

    // Step 13: Calendar schedule
    renderStep13(results, tepResults, inp);

    // open first section
    results.querySelectorAll('.step-section').forEach((s, i) => {
      if (i < 2) s.classList.add('open');
    });
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
    // Step 9: Machine selection
    const c9 = makeStep(parent, 9, 'Попередній вибір ведучих машин');
    let h9 = `<p>Об'єм робіт: ${(maxVol / 1000).toFixed(2)} тис. м³. Середня відстань переміщення: ${carto.Lsr.toFixed(1)} м.</p>`;
    h9 += '<p>Рекомендовані ведучі машини відповідно до таблиці 8 методичних вказівок:</p>';

    const lead1 = suggestions.bulldozers[0] || Machines.bulldozers[0];
    const lead2 = suggestions.loaders[0] || Machines.loaders[0];
    const compact1 = suggestions.compactors.length > 1 ? suggestions.compactors[1] : suggestions.compactors[0];
    const compact2 = compact1;

    h9 += '<h3 style="margin-top:12px;color:var(--primary)">Варіант 1: Бульдозер</h3>';
    h9 += machineInfoHtml(lead1);
    h9 += '<h3 style="margin-top:12px;color:var(--primary)">Варіант 2: Навантажувач</h3>';
    h9 += machineInfoHtml(lead2);
    c9.innerHTML = h9;

    // Step 10: Machine sets
    const c10 = makeStep(parent, 10, 'Комплекти машин');
    const topsoilBulldozer = lead1;
    const set1 = [
      { process: processes[0].name, machine: lead1 },
      { process: processes[1].name, machine: null },
      { process: processes[2].name, machine: lead1 },
      { process: processes[3].name, machine: lead1 },
      { process: processes[4].name, machine: compact1 },
      { process: processes[5].name, machine: lead1 }
    ];
    const set2 = [
      { process: processes[0].name, machine: lead2.type === 'loader' ? (suggestions.bulldozers[0] || lead1) : lead2 },
      { process: processes[1].name, machine: null },
      { process: processes[2].name, machine: lead2 },
      { process: processes[3].name, machine: lead2 },
      { process: processes[4].name, machine: compact2 },
      { process: processes[5].name, machine: lead2.type === 'loader' ? (suggestions.bulldozers[0] || lead1) : lead2 }
    ];

    let h10 = '<table class="data-table"><thead><tr><th>№</th><th>Назва процесу</th><th>Комплект 1</th><th>Комплект 2</th></tr></thead><tbody>';
    for (let i = 0; i < 6; i++) {
      h10 += `<tr><td>${i + 1}</td><td>${processes[i].name}</td>` +
        `<td>${set1[i].machine ? set1[i].machine.name : '—'}</td>` +
        `<td>${set2[i].machine ? set2[i].machine.name : '—'}</td></tr>`;
    }
    h10 += '</tbody></table>';
    c10.innerHTML = h10;

    // Step 11: TEP calculation
    const c11 = makeStep(parent, 11, 'Техніко-економічні показники (ТЕП)');
    const tShift = inp.tShift;
    const Lsr = carto.Lsr;

    const tep1 = computeTEP(set1, processes, lead1, compact1, Lsr, tShift, maxVol, inp);
    const tep2 = computeTEP(set2, processes, lead2, compact2, Lsr, tShift, maxVol, inp);

    let h11 = '<h3 style="color:var(--primary)">Варіант 1</h3>';
    h11 += tepTableHtml(tep1, processes, set1, tShift);
    h11 += '<h3 style="color:var(--primary);margin-top:16px">Варіант 2</h3>';
    h11 += tepTableHtml(tep2, processes, set2, tShift);

    h11 += '<h3 style="margin-top:16px;color:var(--primary)">Порівняльна таблиця</h3>';
    h11 += '<table class="data-table"><thead><tr><th>Показник</th><th>Комплект 1</th><th>Комплект 2</th></tr></thead><tbody>';
    h11 += `<tr><td>Тривалість, змін</td><td>${tep1.totalDuration.toFixed(2)}</td><td>${tep2.totalDuration.toFixed(2)}</td></tr>`;
    h11 += `<tr><td>Трудомісткість, люд-год/м³</td><td>${tep1.labourIntensity.toFixed(4)}</td><td>${tep2.labourIntensity.toFixed(4)}</td></tr>`;
    h11 += `<tr><td>Собівартість С₀, грн</td><td>${tep1.totalCost.toFixed(2)}</td><td>${tep2.totalCost.toFixed(2)}</td></tr>`;
    h11 += `<tr><td>Приведені витрати, грн/м³</td><td>${tep1.reducedCosts.toFixed(4)}</td><td>${tep2.reducedCosts.toFixed(4)}</td></tr>`;
    h11 += '</tbody></table>';

    const winner = tep1.reducedCosts <= tep2.reducedCosts ? 1 : 2;
    const winnerTep = winner === 1 ? tep1 : tep2;
    const winnerSet = winner === 1 ? set1 : set2;
    h11 += `<div class="success-box">Обрано <strong>Комплект ${winner}</strong> з мінімальними приведеними витратами ${winnerTep.reducedCosts.toFixed(4)} грн/м³</div>`;
    c11.innerHTML = h11;

    return { winner, tep: winnerTep, set: winnerSet, processes, maxVol, Lsr };
  }

  function computeTEP(set, processes, leadMachine, compactor, Lsr, tShift, maxVol, inp) {
    const durations = [];
    const machineHourCosts = [];
    const wages = [];
    const machinesUsed = [];

    for (let i = 0; i < 6; i++) {
      const m = set[i].machine;
      let vol = processes[i].volume;
      const isAreaProcess = (i === 0 || i === 5);
      if (isAreaProcess) vol = vol * (inp.topsoil || 0.2);
      let Pe, dur;

      if (!m) {
        dur = 0;
        Pe = 1;
      } else if (m.type === 'bulldozer') {
        const prod = Calc.bulldozerProductivity(m, isAreaProcess ? 30 : Lsr, tShift);
        Pe = prod.Pe;
        dur = vol / Pe;
      } else if (m.type === 'scraper') {
        const prod = Calc.scraperProductivity(m, Lsr, tShift);
        Pe = prod.Pe;
        dur = vol / Pe;
      } else if (m.type === 'loader') {
        const prod = Calc.loaderProductivity(m, isAreaProcess ? 30 : Lsr, tShift);
        Pe = prod.Pe;
        dur = vol / Pe;
      } else if (m.type === 'compactor') {
        Pe = m.productivityPerShift || 1000;
        dur = vol / Pe;
      } else {
        Pe = 500;
        dur = vol / Pe;
      }

      if (dur < 0 || !isFinite(dur) || isNaN(dur)) dur = 0.5;
      durations.push(dur);

      if (m) {
        const Cmh = Calc.machineHourCost(m.oneTime || 0, dur * tShift, m.price, m.amort, m.yearHours, m.Ce);
        machineHourCosts.push(Cmh);
        wages.push(dur * tShift * (m.workers || 1) * 30);
        machinesUsed.push(m);
      } else {
        machineHourCosts.push(0);
        wages.push(0);
        machinesUsed.push({ price: 0, yearHours: 1, oneTime: 0, Ce: 0, workers: 0, name: '—' });
      }
    }

    const totalDuration = durations.reduce((s, d) => s + d, 0);
    const workerCounts = set.map(s => s.machine ? (s.machine.workers || 1) : 0);
    const labourInt = Calc.labourIntensity(durations, workerCounts, tShift, maxVol);
    const C0 = Calc.totalCost(machineHourCosts, durations, tShift, 0, wages);
    const Pv = Calc.reducedCosts(C0, 0.12, machinesUsed, durations, tShift, maxVol);

    return {
      durations, machineHourCosts, wages, machinesUsed,
      totalDuration, labourIntensity: labourInt, totalCost: C0, reducedCosts: Pv
    };
  }

  function tepTableHtml(tep, processes, set, tShift) {
    let html = '<table class="data-table"><thead><tr><th>Процес</th><th>Машина</th><th>Пе, м³/зм</th>' +
      '<th>Тривалість, змін</th><th>С<sub>маш.год</sub>, грн</th></tr></thead><tbody>';
    for (let i = 0; i < 6; i++) {
      const m = set[i].machine;
      const dur = tep.durations[i];
      const pe = dur > 0 ? (processes[i].volume / dur).toFixed(1) : '—';
      html += `<tr><td>${processes[i].name}</td><td>${m ? m.name : '—'}</td>` +
        `<td>${pe}</td><td>${dur.toFixed(2)}</td><td>${tep.machineHourCosts[i].toFixed(2)}</td></tr>`;
    }
    html += `<tr class="total-row"><td colspan="3">Разом</td><td>${tep.totalDuration.toFixed(2)}</td><td>—</td></tr>`;
    html += '</tbody></table>';
    return html;
  }

  function renderStep12(parent, tepResults) {
    const c = makeStep(parent, 12, 'Калькуляція трудових витрат');
    const { tep, set, processes } = tepResults;
    let html = '<table class="data-table"><thead><tr><th>№</th><th>Назва процесу</th><th>Од. вим.</th>' +
      '<th>Об\'єм</th><th>Машина</th><th>Трудомісткість, люд-год</th><th>Зарплата, грн</th></tr></thead><tbody>';
    let totalLabour = 0, totalWage = 0;
    for (let i = 0; i < 6; i++) {
      const m = set[i].machine;
      const labour = tep.durations[i] * (m ? m.workers || 1 : 0) * 8;
      totalLabour += labour;
      totalWage += tep.wages[i];
      html += `<tr><td>${i + 1}</td><td>${processes[i].name}</td><td>${processes[i].unit}</td>` +
        `<td>${processes[i].volume.toFixed(2)}</td><td>${m ? m.name : '—'}</td>` +
        `<td>${labour.toFixed(2)}</td><td>${tep.wages[i].toFixed(2)}</td></tr>`;
    }
    html += `<tr class="total-row"><td colspan="5">Разом</td><td>${totalLabour.toFixed(2)}</td><td>${totalWage.toFixed(2)}</td></tr>`;
    html += '</tbody></table>';
    c.innerHTML = html;
  }

  function renderStep13(parent, tepResults, inp) {
    const c = makeStep(parent, 13, 'Календарний графік виконання робіт');
    const { tep, set, processes } = tepResults;
    const numShifts = inp.numShifts;

    const schedData = [];
    for (let i = 0; i < 6; i++) {
      if (tep.durations[i] <= 0) continue;
      const m = set[i].machine;
      schedData.push({
        name: processes[i].name,
        duration: tep.durations[i],
        workers: m ? (m.workers || 1) : 1,
        shifts: numShifts,
        machine: m ? m.name : '—',
        volumeStr: `${processes[i].volume.toFixed(0)} ${processes[i].unit}`
      });
    }

    let html = '<div class="diagram-container" id="scheduleDiagram"></div>';
    c.innerHTML = html;
    setTimeout(() => Schedule.drawSchedule('scheduleDiagram', schedData), 50);
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
      if (input) input.value = marks[i].toFixed(2);
      const label = document.querySelector(`.bmark-label[data-idx="${i}"]`);
      if (label) label.textContent = marks[i].toFixed(2);
    }
  }

  // ===== Event bindings =====
  document.getElementById('btnCalculate').addEventListener('click', runCalculations);
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
