/*  calc.js — Calculation engine for vertical planning
    Implements formulas 1-39 from the methodology */

const Calc = (() => {

  // -------- Formula (1): Black mark interpolation --------
  function blackMark(H, h, l, L) {
    return H + h * l / L;
  }

  // -------- Formula (2): Average planning mark (squares) --------
  function averagePlanningMark(blackMarks, cols, rows) {
    let sumH1 = 0, sumH2 = 0, sumH4 = 0;
    const classification = classifyVertices(cols, rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const k = classification[idx];
        const H = blackMarks[idx];
        if (k === 1) sumH1 += H;
        else if (k === 2) sumH2 += H;
        else if (k === 4) sumH4 += H;
      }
    }
    const n = (cols - 1) * (rows - 1);
    return (sumH1 + 2 * sumH2 + 4 * sumH4) / (4 * n);
  }

  function classifyVertices(cols, rows) {
    const result = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let count = 0;
        if (r > 0 && c > 0) count++;
        if (r > 0 && c < cols - 1) count++;
        if (r < rows - 1 && c > 0) count++;
        if (r < rows - 1 && c < cols - 1) count++;
        result.push(count);
      }
    }
    return result;
  }

  // -------- Formula (4): Red (project) marks --------
  function computeRedMarks(Hser, A, B, i1, i2, cols, rows) {
    const squareA = A / (cols - 1);
    const squareB = B / (rows - 1);
    const marks = [];
    const midC = (cols - 1) / 2;
    const midR = (rows - 1) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = (c - midC) * squareA;
        const dy = (r - midR) * squareB;
        marks.push(Hser + dx * i2 + dy * i1);
      }
    }
    return marks;
  }

  // -------- Formula (5): Working marks --------
  function computeWorkingMarks(redMarks, blackMarks) {
    return redMarks.map((r, i) => r - blackMarks[i]);
  }

  // -------- Zero line points --------
  function computeZeroPoints(workingMarks, cols, rows, squareA, squareB) {
    const pts = [];
    const idx = (r, c) => r * cols + c;
    const edges = getGridEdges(cols, rows);
    for (const [r1, c1, r2, c2] of edges) {
      const h1 = workingMarks[idx(r1, c1)];
      const h2 = workingMarks[idx(r2, c2)];
      if ((h1 >= 0 && h2 < 0) || (h1 < 0 && h2 >= 0)) {
        const t = Math.abs(h1) / (Math.abs(h1) + Math.abs(h2));
        const x = c1 * squareA + t * (c2 - c1) * squareA;
        const y = r1 * squareB + t * (r2 - r1) * squareB;
        pts.push({ x, y, edge: [r1, c1, r2, c2] });
      }
    }
    return sortZeroPoints(pts);
  }

  function getGridEdges(cols, rows) {
    const edges = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        edges.push([r, c, r, c + 1]);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        edges.push([r, c, r + 1, c]);
      }
    }
    return edges;
  }

  function sortZeroPoints(pts) {
    if (pts.length < 2) return pts;
    const sorted = [pts.shift()];
    while (pts.length) {
      const last = sorted[sorted.length - 1];
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - last.x, pts[i].y - last.y);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      sorted.push(pts.splice(bestIdx, 1)[0]);
    }
    return sorted;
  }

  // -------- Formula (6): Volume of a full (same-sign) square --------
  function volumeFull(a, h1, h2, h3, h4) {
    return a * a * Math.abs(h1 + h2 + h3 + h4) / 4;
  }

  // -------- Formula (7): Volumes of a transitional square --------
  function volumeTransitional(a, h1, h2, h3, h4) {
    const marks = [h1, h2, h3, h4];
    const pos = marks.filter(h => h >= 0);
    const neg = marks.filter(h => h < 0);
    const sumAll = marks.reduce((s, h) => s + Math.abs(h), 0);

    let vFill = 0, vCut = 0;
    if (pos.length > 0) {
      const sumPos = pos.reduce((s, h) => s + h, 0);
      vFill = a * a * sumPos * sumPos / (4 * sumAll);
    }
    if (neg.length > 0) {
      const sumNeg = neg.reduce((s, h) => s + Math.abs(h), 0);
      vCut = a * a * sumNeg * sumNeg / (4 * sumAll);
    }
    return { fill: vFill, cut: vCut };
  }

  // -------- Compute all square volumes --------
  function computeVolumes(workingMarks, cols, rows, squareA) {
    const result = [];
    let totalFill = 0, totalCut = 0;
    const idx = (r, c) => r * cols + c;
    let sqNum = 1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const h1 = workingMarks[idx(r, c)];
        const h2 = workingMarks[idx(r, c + 1)];
        const h3 = workingMarks[idx(r + 1, c + 1)];
        const h4 = workingMarks[idx(r + 1, c)];
        const marks = [h1, h2, h3, h4];
        const allPos = marks.every(h => h >= 0);
        const allNeg = marks.every(h => h < 0);
        let fill = 0, cut = 0;
        if (allPos) {
          fill = volumeFull(squareA, h1, h2, h3, h4);
        } else if (allNeg) {
          cut = volumeFull(squareA, h1, h2, h3, h4);
        } else {
          const v = volumeTransitional(squareA, h1, h2, h3, h4);
          fill = v.fill;
          cut = v.cut;
        }
        totalFill += fill;
        totalCut += cut;
        result.push({
          num: sqNum++, h1, h2, h3, h4,
          sumAbsH: marks.reduce((s, h) => s + Math.abs(h), 0),
          fill, cut,
          type: allPos ? 'fill' : allNeg ? 'cut' : 'transition'
        });
      }
    }
    return { squares: result, totalFill, totalCut };
  }

  // -------- Earthwork balance check --------
  function balanceCheck(totalFill, totalCut, looseningPct) {
    const loosened = totalCut * (1 + looseningPct / 100);
    const maxVol = Math.max(totalFill, loosened);
    const error = Math.abs(totalFill - loosened) / maxVol * 100;
    return { loosened, error, ok: error <= 5, maxVol };
  }

  // -------- Earthwork mass cartogram & average transport distance --------
  function computeCartogram(volumeData, cols, rows, squareA, squareB) {
    const numSqCols = cols - 1;
    const numSqRows = rows - 1;

    const colFill = new Array(numSqCols).fill(0);
    const colCut = new Array(numSqCols).fill(0);
    const rowFill = new Array(numSqRows).fill(0);
    const rowCut = new Array(numSqRows).fill(0);

    for (const sq of volumeData.squares) {
      const c = (sq.num - 1) % numSqCols;
      const r = Math.floor((sq.num - 1) / numSqCols);
      colFill[c] += sq.fill;
      colCut[c] += sq.cut;
      rowFill[r] += sq.fill;
      rowCut[r] += sq.cut;
    }

    const cumColFill = cumulativeSum(colFill);
    const cumColCut = cumulativeSum(colCut);
    const cumRowFill = cumulativeSum(rowFill);
    const cumRowCut = cumulativeSum(rowCut);

    // ½V method (per methodology): find where cumulative = total/2
    const cxFill = medianPosition(cumColFill, squareA);
    const cxCut = medianPosition(cumColCut, squareA);
    const cyFill = medianPosition(cumRowFill, squareB);
    const cyCut = medianPosition(cumRowCut, squareB);

    const Lsr = Math.hypot(cxFill - cxCut, cyFill - cyCut);

    return {
      colFill, colCut, rowFill, rowCut,
      cumColFill, cumColCut, cumRowFill, cumRowCut,
      cxFill, cxCut, cyFill, cyCut, Lsr
    };
  }

  function cumulativeSum(arr) {
    const res = [0];
    for (let i = 0; i < arr.length; i++) res.push(res[i] + arr[i]);
    return res;
  }

  // ½V: position (in meters) where cumulative volume reaches half total
  function medianPosition(cumArr, step) {
    const total = cumArr[cumArr.length - 1];
    if (total <= 0) return 0;
    const half = total / 2;
    for (let i = 0; i < cumArr.length - 1; i++) {
      if (cumArr[i] <= half && cumArr[i + 1] >= half) {
        const t = (half - cumArr[i]) / Math.max(cumArr[i + 1] - cumArr[i], 0.001);
        return (i + t) * step;
      }
    }
    return (cumArr.length - 1) * step / 2;
  }

  // -------- Process structure volumes --------
  function processVolumes(A, B, totalFill, totalCut, kInitial, kResidual) {
    return [
      { id: 'topsoil_cut', name: 'Зрізання рослинного шару ґрунту', unit: 'м²', volume: A * B },
      { id: 'soil_loosening', name: 'Розпушування ґрунту', unit: 'м³', volume: totalCut },
      { id: 'soil_development_move', name: 'Розроблення та переміщення ґрунту', unit: 'м³', volume: totalCut },
      { id: 'soil_spreading', name: 'Розрівнювання ґрунту', unit: 'м³', volume: totalFill * kInitial },
      { id: 'soil_compaction', name: 'Ущільнення ґрунту', unit: 'м³', volume: totalFill * kResidual },
      { id: 'final_grading', name: 'Остаточне планування майданчика', unit: 'м²', volume: A * B }
    ];
  }

  // -------- Productivity formulas --------

  // Formula (16): Bulldozer exploitational productivity, m³/shift
  function bulldozerProductivity(machine, Lsr, tShift) {
    const a = machine.bladeLength;
    const H = machine.bladeHeight;
    const phi = (machine.cutAngle || 40) * Math.PI / 180;
    const Kr = machine.kLoosening || 1.2;
    const Kzb = Math.max(0.3, 1 - 0.005 * Lsr);
    const Vg = a * H * H / (2 * Kr * Math.tan(phi));
    const vCut = machine.speedCut || 3;
    const vEmpty = machine.speedEmpty || 8;
    const vLoaded = machine.speedLoaded || 5;
    const Lg = Math.min(2 * Vg / (a * 0.2), Lsr * 0.8);
    const tCut = 3.6 * Lg / vCut;
    const tMove = 3.6 * Math.max(Lsr - Lg, 1) / vLoaded;
    const tReturn = 3.6 * Lsr / vEmpty;
    const tCycle = Math.max(tCut + tMove + tReturn, 10);
    const Kv = machine.kUsage || 0.85;
    const Ki = machine.kSlope || 1.0;
    const Pe = tShift * 3600 * Vg * Kzb * Ki * Kv / tCycle;
    return {
      Pe: Math.max(Pe, 1), Vg, Kzb, Lg, tCut, tMove, tReturn, tCycle, Kv, Ki
    };
  }

  // Formula (23): Scraper productivity, m³/shift
  function scraperProductivity(machine, Lsr, tShift) {
    const q = machine.bucketVolume;
    const Kn = machine.kFilling || 0.85;
    const Kr = machine.kLoosening || 1.2;
    const Km = Kn / Kr;
    const Kv = machine.kUsage || 0.80;
    const Kh = machine.kDepth || 1.0;
    const aW = machine.cutWidth;
    const hMax = machine.maxCutThickness;
    const Kp = machine.kDrag || 0.3;
    const Lz = q * Km * (1 + Kp) / (aW * hMax);
    const vLoad = machine.speedLoad || 3;
    const vFull = machine.speedFull || 20;
    const vEmpty = machine.speedEmpty || 35;
    const Kpp = machine.kAccel || 0.8;
    const tLoad = 3.6 * Lz / (vLoad * Kpp);
    const tFull = 3.6 * Lsr / (vFull * Kpp);
    const tEmpty = 3.6 * Lsr / (vEmpty * Kpp);
    const tDump = machine.dumpTime || 25;
    const tTurn = machine.turnTime || 40;
    const tCycle = Math.max(tLoad + tFull + tDump + tEmpty + tTurn, 10);
    const Pe = tShift * 3600 * q * Km * Kh * Kv / tCycle;
    return { Pe: Math.max(Pe, 1), Km, Lz, tLoad, tFull, tEmpty, tCycle, Kv, q };
  }

  // Formula (28): Loader productivity, m³/shift
  function loaderProductivity(machine, Lsr, tShift) {
    const q = machine.bucketVolume;
    const Kn = machine.kFilling || 0.9;
    const Kr = machine.kLoosening || 1.2;
    const Kv = machine.kUsage || 0.80;
    const vTr = machine.speedLoaded || 8;
    const vEmpty = machine.speedEmpty || 15;
    const tLoad = machine.loadTime || 7;
    const tDump = 0.6 * q + 2.5;
    const tTr = 3.6 * Math.max(Lsr, 1) / vTr;
    const tReturn = 3.6 * Math.max(Lsr, 1) / vEmpty;
    const tCycle = Math.max(tLoad + tTr + tDump + tReturn, 10);
    const Pe = tShift * 3600 * q * Kn * Kv / (Kr * tCycle);
    return { Pe: Math.max(Pe, 1), tCycle, tDump, tTr, tReturn, Kv, q };
  }

  // -------- Duration of a process --------
  function processDuration(volume, productivity) {
    return volume / productivity;
  }

  // -------- Formula (35-36): Labour intensity --------
  function labourIntensity(durations, workerCounts, tShift, totalVolume) {
    let totalHours = 0;
    for (let i = 0; i < durations.length; i++) {
      totalHours += durations[i] * workerCounts[i] * tShift;
    }
    return totalHours / totalVolume;
  }

  // -------- Formula (38): Machine-hour cost --------
  function machineHourCost(O, Ti, M, A, Tr, Ce) {
    const safeTi = Math.max(Ti, 1);
    const safeTr = Math.max(Tr, 1);
    return O / safeTi + M * 1000 * A / (100 * safeTr) + Ce;
  }

  // -------- Formula (37): Total cost --------
  function totalCost(machineHourCosts, durations, tShift, Cdod, wages) {
    let sumMC = 0;
    for (let i = 0; i < machineHourCosts.length; i++) {
      sumMC += machineHourCosts[i] * durations[i] * tShift;
    }
    const sumWages = wages.reduce((s, w) => s + w, 0);
    return 1.08 * (sumMC + Cdod) + 1.5 * sumWages;
  }

  // -------- Formula (39): Reduced costs per m³ --------
  function reducedCosts(C0, En, machines, durations, tShift, totalVolume) {
    let sumMT = 0;
    for (let i = 0; i < machines.length; i++) {
      sumMT += (machines[i].price * 1000) * (durations[i] * tShift) / machines[i].yearHours;
    }
    return (C0 + En * sumMT) / totalVolume;
  }

  // -------- Balance correction --------
  function correctionDeltaH(totalFill, totalCut, n, a) {
    const diff = totalCut - totalFill;
    return diff / (n * a * a);
  }

  return {
    blackMark, averagePlanningMark, classifyVertices,
    computeRedMarks, computeWorkingMarks,
    computeZeroPoints, getGridEdges,
    volumeFull, volumeTransitional, computeVolumes,
    balanceCheck, correctionDeltaH,
    computeCartogram, processVolumes,
    bulldozerProductivity, scraperProductivity, loaderProductivity,
    processDuration, labourIntensity,
    machineHourCost, totalCost, reducedCosts
  };
})();
