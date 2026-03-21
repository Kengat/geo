/* machines.js — Machine database from Appendix A + Appendix Г */

const Machines = (() => {

  const bulldozers = [
    {
      id: 'dz37', name: 'ДЗ-37 (Д-579)', type: 'bulldozer',
      base: 'МТЗ-50', power: 40,
      bladeLength: 2.1, bladeHeight: 0.65,
      speedCut: 2.65, speedEmpty: 7, speedLoaded: 4,
      cutAngle: 60, volumeMoved: 0.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 54.15, amort: 40, yearHours: 1800,
      oneTime: 355.5,
      Ce: 10.35 + 0.90 + 8.25 + 2.10 + 21.0,
      workers: 1
    },
    {
      id: 'dz4', name: 'ДЗ-4 (Д-444)', type: 'bulldozer',
      base: 'ДТ-54А', power: 40,
      bladeLength: 2.28, bladeHeight: 0.79,
      speedCut: 3.6, speedEmpty: 7.9, speedLoaded: 5,
      cutAngle: 60, volumeMoved: 0.75,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 48.0, amort: 40, yearHours: 1800,
      oneTime: 355.5,
      Ce: 10.35 + 0.90 + 8.25 + 2.10 + 21.0,
      workers: 1
    },
    {
      id: 'dz29', name: 'ДЗ-29 (Д-535)', type: 'bulldozer',
      base: 'Т-74-С2', power: 59,
      bladeLength: 2.52, bladeHeight: 0.8,
      speedCut: 5.1, speedEmpty: 10.8, speedLoaded: 6,
      cutAngle: 55, volumeMoved: 1.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 48.9, amort: 40, yearHours: 1800,
      oneTime: 355.5,
      Ce: 13.20 + 0.30 + 12.30 + 3.15 + 23.7,
      workers: 1
    },
    {
      id: 'dz42', name: 'ДЗ-42 (Д-606)', type: 'bulldozer',
      base: 'ДТ-75-С2', power: 59,
      bladeLength: 2.56, bladeHeight: 0.8,
      speedCut: 4.5, speedEmpty: 11.4, speedLoaded: 6,
      cutAngle: 55, volumeMoved: 1.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 73.65, amort: 40, yearHours: 1800,
      oneTime: 355.5,
      Ce: 13.20 + 0.30 + 12.30 + 3.15 + 23.7,
      workers: 1
    },
    {
      id: 'dz17', name: 'ДЗ-17 (Д-493)', type: 'bulldozer',
      base: 'Т-100МЗ', power: 79,
      bladeLength: 3.94, bladeHeight: 1.1,
      speedCut: 2.4, speedEmpty: 10.1, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 3.3,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 124.8, amort: 40, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 0.45 + 16.35 + 4.05 + 26.8,
      workers: 1
    },
    {
      id: 'dz53', name: 'ДЗ-53 (Д-494)', type: 'bulldozer',
      base: 'Т-100МЗ', power: 79,
      bladeLength: 3.2, bladeHeight: 1.2,
      speedCut: 2.4, speedEmpty: 10.1, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 3.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 128.4, amort: 40, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 0.45 + 16.35 + 4.05 + 26.8,
      workers: 1
    },
    {
      id: 'dp9', name: 'ДП-9 (бульдозер-розпушувач)', type: 'bulldozer',
      base: 'Т-74-С2', power: 59,
      bladeLength: 2.52, bladeHeight: 0.8,
      speedCut: 2.5, speedEmpty: 10.0, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 1.8,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 72.0, amort: 40, yearHours: 1890,
      oneTime: 355.5,
      Ce: 13.20 + 0.30 + 12.30 + 3.15 + 23.7,
      workers: 1,
      ripper: true
    },
    {
      id: 'dp15', name: 'ДП-15 (бульдозер-розпушувач)', type: 'bulldozer',
      base: 'Т-130М', power: 79,
      bladeLength: 3.2, bladeHeight: 1.0,
      speedCut: 2.2, speedEmpty: 9.8, speedLoaded: 4.8,
      cutAngle: 55, volumeMoved: 2.8,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 118.5, amort: 40, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 0.45 + 16.35 + 4.05 + 26.8,
      workers: 1,
      ripper: true
    },
    {
      id: 'dp25', name: 'ДП-25 (бульдозер-розпушувач)', type: 'bulldozer',
      base: 'Т-180КС', power: 132,
      bladeLength: 3.64, bladeHeight: 1.23,
      speedCut: 2.5, speedEmpty: 11.5, speedLoaded: 5.5,
      cutAngle: 55, volumeMoved: 4.0,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 198.0, amort: 25, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 4.5 + 29.40 + 7.35 + 26.8,
      workers: 1,
      ripper: true
    },
    {
      id: 'dp34', name: 'ДП-34 (бульдозер-розпушувач)', type: 'bulldozer',
      base: 'ДЕТ-250', power: 228,
      bladeLength: 4.54, bladeHeight: 1.55,
      speedCut: 2.0, speedEmpty: 11.5, speedLoaded: 4.5,
      cutAngle: 55, volumeMoved: 6.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 780.0, amort: 25, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 0.75 + 40.95 + 10.20 + 26.8,
      workers: 1,
      ripper: true
    },
    {
      id: 'dz35b', name: 'ДЗ-35Б (Д-275)', type: 'bulldozer',
      base: 'Т-180КС', power: 132,
      bladeLength: 3.64, bladeHeight: 1.23,
      speedCut: 2.9, speedEmpty: 12.0, speedLoaded: 6,
      cutAngle: 55, volumeMoved: 4.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 189.75, amort: 25, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 4.5 + 29.40 + 7.35 + 26.8,
      workers: 1
    },
    {
      id: 'dz34s', name: 'ДЗ-34С (Д-572)', type: 'bulldozer',
      base: 'ДЕТ-250', power: 228,
      bladeLength: 4.54, bladeHeight: 1.55,
      speedCut: 2.3, speedEmpty: 12.0, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 7.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 795.0, amort: 25, yearHours: 2580,
      oneTime: 450.0,
      Ce: 21.0 + 0.75 + 40.95 + 10.20 + 26.8,
      workers: 1
    },
    {
      id: 'catD4', name: 'CAT D4', type: 'bulldozer',
      base: 'Cat C7.1', power: 97,
      bladeLength: 3.196, bladeHeight: 1.291,
      speedCut: 3, speedEmpty: 10, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 3.3,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 236.0, amort: 25, yearHours: 2580,
      oneTime: 500,
      Ce: 18.0 + 1.0 + 20.0 + 5.0 + 28.0,
      workers: 1
    },
    {
      id: 'catD5', name: 'CAT D5', type: 'bulldozer',
      base: 'Cat C7.1', power: 127,
      bladeLength: 3.272, bladeHeight: 1.261,
      speedCut: 3, speedEmpty: 10, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 3.5,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 358.0, amort: 25, yearHours: 2580,
      oneTime: 550,
      Ce: 22.0 + 1.0 + 25.0 + 6.0 + 28.0,
      workers: 1
    },
    {
      id: 'catD6', name: 'CAT D6 GC', type: 'bulldozer',
      base: 'Cat 3306B', power: 158,
      bladeLength: 3.26, bladeHeight: 1.522,
      speedCut: 3, speedEmpty: 12, speedLoaded: 5,
      cutAngle: 55, volumeMoved: 3.8,
      kLoosening: 1.22, kUsage: 0.85, kSlope: 1.0,
      price: 395.0, amort: 25, yearHours: 2580,
      oneTime: 600,
      Ce: 25.0 + 1.0 + 28.0 + 7.0 + 30.0,
      workers: 1
    }
  ];

  const scrapers = [
    {
      id: 'dz30', name: 'ДЗ-30 (Д-541А)', type: 'scraper',
      tractor: 'Т-74-С9', bucketVolume: 3,
      cutWidth: 2.15, maxCutThickness: 0.15,
      speedLoad: 4.5, speedFull: 5.5, speedEmpty: 9.5,
      dumpTime: 20, turnTime: 40,
      kFilling: 0.85, kLoosening: 1.22, kDrag: 0.3,
      kUsage: 0.80, kDepth: 1.0, kAccel: 0.8,
      price: 74.1, amort: 40, yearHours: 1890,
      oneTime: 355.5,
      Ce: 10.05 + 1.20 + 12.30 + 3.15 + 23.7,
      workers: 1
    },
    {
      id: 'dz33', name: 'ДЗ-33 (Д-569)', type: 'scraper',
      tractor: 'Т-74-С9', bucketVolume: 3,
      cutWidth: 2.1, maxCutThickness: 0.2,
      speedLoad: 4.12, speedFull: 5.4, speedEmpty: 9.3,
      dumpTime: 20, turnTime: 40,
      kFilling: 0.85, kLoosening: 1.22, kDrag: 0.3,
      kUsage: 0.80, kDepth: 1.0, kAccel: 0.8,
      price: 74.1, amort: 40, yearHours: 1890,
      oneTime: 355.5,
      Ce: 10.05 + 1.20 + 12.30 + 3.15 + 23.7,
      workers: 1
    },
    {
      id: 'dz12a', name: 'ДЗ-12А (Д-498)', type: 'scraper',
      tractor: 'Т-100М', bucketVolume: 6,
      cutWidth: 2.67, maxCutThickness: 0.32,
      speedLoad: 2.9, speedFull: 4.5, speedEmpty: 6.4,
      dumpTime: 21, turnTime: 40,
      kFilling: 0.85, kLoosening: 1.22, kDrag: 0.3,
      kUsage: 0.80, kDepth: 1.0, kAccel: 0.8,
      price: 137.25, amort: 25, yearHours: 2250,
      oneTime: 450.0,
      Ce: 14.10 + 5.25 + 16.35 + 4.05 + 23.7,
      workers: 1
    },
    {
      id: 'dz20', name: 'ДЗ-20 (Д-498)', type: 'scraper',
      tractor: 'Т-100МГС', bucketVolume: 7,
      cutWidth: 2.65, maxCutThickness: 0.3,
      speedLoad: 2.9, speedFull: 4.5, speedEmpty: 6.5,
      dumpTime: 21, turnTime: 40,
      kFilling: 0.85, kLoosening: 1.22, kDrag: 0.3,
      kUsage: 0.80, kDepth: 1.0, kAccel: 0.8,
      price: 189.3, amort: 25, yearHours: 2250,
      oneTime: 450.0,
      Ce: 14.10 + 5.25 + 16.35 + 4.05 + 23.7,
      workers: 1
    },
    {
      id: 'dz11p', name: 'ДЗ-11П (Д-357А)', type: 'scraper',
      tractor: 'МоАЗ-546П', bucketVolume: 8,
      cutWidth: 2.82, maxCutThickness: 0.3,
      speedLoad: 2, speedFull: 23, speedEmpty: 40,
      dumpTime: 42, turnTime: 25,
      kFilling: 0.85, kLoosening: 1.22, kDrag: 0.3,
      kUsage: 0.80, kDepth: 1.0, kAccel: 0.8,
      price: 307.5, amort: 25, yearHours: 2250,
      oneTime: 450.0,
      Ce: 15.30 + 17.25 + 29.40 + 7.35 + 26.8,
      workers: 1
    },
    {
      id: 'dz13', name: 'ДЗ-13 (Д-392)', type: 'scraper',
      tractor: 'БелАЗ-531', bucketVolume: 15,
      cutWidth: 2.93, maxCutThickness: 0.35,
      speedLoad: 2, speedFull: 25, speedEmpty: 45,
      dumpTime: 42, turnTime: 25,
      kFilling: 0.85, kLoosening: 1.22, kDrag: 0.3,
      kUsage: 0.80, kDepth: 1.0, kAccel: 0.8,
      price: 914.85, amort: 25, yearHours: 2250,
      oneTime: 450.0,
      Ce: 15.30 + 44.10 + 58.95 + 14.70 + 26.8,
      workers: 1
    }
  ];

  const loaders = [
    {
      id: 'un050', name: 'UN-050', type: 'loader',
      base: 'Спецшасі', power: 36.5,
      bucketVolume: 0.6, cutWidth: 1.47,
      maxDumpHeight: 2.48,
      speedLoaded: 8, speedEmpty: 15,
      loadTime: 7,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 150.0, amort: 22, yearHours: 2580,
      oneTime: 1.35,
      Ce: 6.75 + 5.10 + 23.7,
      workers: 1
    },
    {
      id: 'to6a', name: 'ТО-6А', type: 'loader',
      base: 'Т-150', power: 59,
      bucketVolume: 1.0, cutWidth: 2.34,
      maxDumpHeight: 2.8,
      speedLoaded: 10, speedEmpty: 20,
      loadTime: 7,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 181.485, amort: 24, yearHours: 2580,
      oneTime: 1.35,
      Ce: 7.05 + 5.10 + 26.8,
      workers: 1
    },
    {
      id: 'to18', name: 'ТО-18', type: 'loader',
      base: 'К-702', power: 100,
      bucketVolume: 1.5, cutWidth: 2.44,
      maxDumpHeight: 2.8,
      speedLoaded: 12, speedEmpty: 25,
      loadTime: 7,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 305.745, amort: 22.9, yearHours: 2580,
      oneTime: 1.5,
      Ce: 8.10 + 8.40 + 26.8,
      workers: 1
    },
    {
      id: 'to25', name: 'ТО-25', type: 'loader',
      base: 'Спецшасі', power: 121.5,
      bucketVolume: 1.5, cutWidth: 2.44,
      maxDumpHeight: 2.8,
      speedLoaded: 10, speedEmpty: 20,
      loadTime: 7,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 310.65, amort: 22.9, yearHours: 2580,
      oneTime: 1.5,
      Ce: 8.10 + 9.90 + 23.7,
      workers: 1
    },
    {
      id: 'to11', name: 'ТО-11', type: 'loader',
      base: 'Спецшасі', power: 147,
      bucketVolume: 2.0, cutWidth: 2.8,
      maxDumpHeight: 3.2,
      speedLoaded: 12, speedEmpty: 25,
      loadTime: 8,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 441.45, amort: 24, yearHours: 2580,
      oneTime: 1.8,
      Ce: 8.55 + 12.00 + 23.7,
      workers: 1
    },
    {
      id: 'l34', name: 'L-34', type: 'loader',
      base: 'Спецшасі', power: 162,
      bucketVolume: 3.6, cutWidth: 2.8,
      maxDumpHeight: 3.1,
      speedLoaded: 10, speedEmpty: 22,
      loadTime: 8,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 372.3, amort: 24, yearHours: 2580,
      oneTime: 1.8,
      Ce: 9.15 + 10.65 + 26.8,
      workers: 1
    },
    {
      id: 'cat924k', name: 'CAT 924К', type: 'loader',
      base: 'Cat C7.1', power: 105,
      bucketVolume: 2.0, cutWidth: 2.55,
      maxDumpHeight: 4.997,
      speedLoaded: 10, speedEmpty: 20,
      loadTime: 7,
      kFilling: 0.9, kLoosening: 1.22, kUsage: 0.80,
      price: 155.0, amort: 22, yearHours: 2580,
      oneTime: 2.0,
      Ce: 8.0 + 8.0 + 26.0,
      workers: 1
    }
  ];

  const compactors = [
    {
      id: 'du4', name: 'ДУ-4', type: 'compactor',
      power: 40,
      price: 56.55, amort: 13.6, yearHours: 2500,
      oneTime: 355.5,
      Ce: 0.45 + 23.7,
      productivityPerShift: 800,
      workers: 1
    },
    {
      id: 'du16v', name: 'ДУ-16В', type: 'compactor',
      power: 100,
      price: 348.0, amort: 25.2, yearHours: 2700,
      oneTime: 355.5,
      Ce: 2.25 + 28.50 + 7.35 + 23.7,
      productivityPerShift: 1500,
      workers: 1
    },
    {
      id: 'du31a', name: 'ДУ-31А', type: 'compactor',
      power: 80,
      price: 256.8, amort: 25.2, yearHours: 2700,
      oneTime: 355.5,
      Ce: 2.25 + 18.00 + 4.50 + 23.7,
      productivityPerShift: 1200,
      workers: 1
    },
    {
      id: 'du10a', name: 'ДУ-10А', type: 'compactor',
      power: 30,
      price: 29.70, amort: 25.2, yearHours: 2700,
      oneTime: 355.5,
      Ce: 2.25 + 1.35 + 0.30 + 21.0,
      productivityPerShift: 600,
      workers: 1
    },
    {
      id: 'du25', name: 'ДУ-25 (Д-613А)', type: 'compactor',
      power: 50,
      price: 39.15, amort: 25.2, yearHours: 2700,
      oneTime: 355.5,
      Ce: 2.25 + 3.30 + 0.90 + 21.0,
      productivityPerShift: 900,
      workers: 1
    },
    {
      id: 'catCS56B', name: 'CAT CS56B', type: 'compactor',
      power: 117,
      price: 130.0, amort: 20, yearHours: 2700,
      oneTime: 400,
      Ce: 3.0 + 15.0 + 4.0 + 25.0,
      productivityPerShift: 1600,
      workers: 1
    },
    {
      id: 'catCS66B', name: 'CAT CS66B', type: 'compactor',
      power: 117,
      price: 189.5, amort: 20, yearHours: 2700,
      oneTime: 450,
      Ce: 3.5 + 18.0 + 5.0 + 26.0,
      productivityPerShift: 2000,
      workers: 1
    }
  ];

  const soilTypes = [
    { id: 'clay_soft', name: 'Глина м\'яка жирна', kInitial: 1.27, kResidual: 1.055 },
    { id: 'gravel', name: 'Гравійно-галькові ґрунти', kInitial: 1.18, kResidual: 1.065 },
    { id: 'topsoil', name: 'Рослинний ґрунт', kInitial: 1.225, kResidual: 1.035 },
    { id: 'loess_soft', name: 'Лес м\'який', kInitial: 1.21, kResidual: 1.045 },
    { id: 'loess_hard', name: 'Лес твердий', kInitial: 1.27, kResidual: 1.055 },
    { id: 'sand', name: 'Пісок', kInitial: 1.125, kResidual: 1.035 },
    { id: 'loam_light', name: 'Суглинок легкий', kInitial: 1.21, kResidual: 1.045 },
    { id: 'loam_heavy', name: 'Суглинок важкий', kInitial: 1.27, kResidual: 1.065 },
    { id: 'sandy_loam', name: 'Супісок', kInitial: 1.145, kResidual: 1.04 },
    { id: 'chernozem', name: 'Чорнозем', kInitial: 1.25, kResidual: 1.06 }
  ];

  function suggestMachines(totalVolume, Lsr) {
    const vol = totalVolume / 1000;
    const suggestions = { bulldozers: [], scrapers: [], loaders: [], compactors: [] };

    for (const b of bulldozers) {
      if (Lsr > 100 && b.power < 79) continue;
      if (vol <= 1.5 && b.power <= 90) suggestions.bulldozers.push(b);
      else if (vol > 1.5 && vol <= 20 && b.power >= 40 && b.power <= 160) suggestions.bulldozers.push(b);
      else if (vol > 20 && vol <= 50 && b.power >= 90) suggestions.bulldozers.push(b);
      else if (vol > 50 && b.power >= 160) suggestions.bulldozers.push(b);
    }

    for (const s of scrapers) {
      if (vol <= 1.5 && s.bucketVolume <= 5) suggestions.scrapers.push(s);
      else if (vol > 1.5 && vol <= 20 && s.bucketVolume >= 3 && s.bucketVolume <= 10) suggestions.scrapers.push(s);
      else if (vol > 20 && s.bucketVolume >= 8) suggestions.scrapers.push(s);
    }

    for (const l of loaders) {
      if (vol <= 1.5 && l.bucketVolume <= 1) suggestions.loaders.push(l);
      else if (vol > 1.5 && vol <= 20 && l.bucketVolume >= 0.6 && l.bucketVolume <= 2.5) suggestions.loaders.push(l);
      else if (vol > 20 && l.bucketVolume >= 1.5) suggestions.loaders.push(l);
    }

    suggestions.compactors = [...compactors];

    if (suggestions.bulldozers.length === 0) suggestions.bulldozers = bulldozers.filter(b => b.power >= 79).slice(0, 3);
    if (suggestions.bulldozers.length === 0) suggestions.bulldozers = bulldozers.slice(-3);
    if (suggestions.scrapers.length === 0) suggestions.scrapers = scrapers.slice(0, 3);
    if (suggestions.loaders.length === 0) suggestions.loaders = loaders.slice(0, 3);

    return suggestions;
  }

  /** Підбір бульдозера-розпушувача за тими ж обсягом (тис. м³) і Lsr, що табл. 8 для ведучих бульдозерів; серед допустимих обирається найближчий за потужністю до рекомендованого бульдозера. */
  function suggestRipperBulldozer(totalVolume, Lsr, cachedSuggestions) {
    const vol = totalVolume / 1000;
    const rippers = bulldozers.filter(b => b.ripper);
    if (rippers.length === 0) return null;

    const candidates = [];
    for (const b of rippers) {
      if (Lsr > 100 && b.power < 79) continue;
      if (vol <= 1.5 && b.power <= 90) candidates.push(b);
      else if (vol > 1.5 && vol <= 20 && b.power >= 40 && b.power <= 160) candidates.push(b);
      else if (vol > 20 && vol <= 50 && b.power >= 90) candidates.push(b);
      else if (vol > 50 && b.power >= 160) candidates.push(b);
    }

    const lead = (cachedSuggestions && cachedSuggestions.bulldozers && cachedSuggestions.bulldozers[0])
      || suggestMachines(totalVolume, Lsr).bulldozers[0]
      || null;

    function pickClosest(pool) {
      if (!pool.length) return null;
      if (!lead) return pool[0];
      let best = pool[0];
      let bestD = Math.abs(best.power - lead.power);
      for (let i = 1; i < pool.length; i++) {
        const r = pool[i];
        const d = Math.abs(r.power - lead.power);
        if (d < bestD) {
          best = r;
          bestD = d;
        }
      }
      return best;
    }

    if (candidates.length) return pickClosest(candidates);
    return pickClosest(rippers);
  }

  function getAllByType(type) {
    switch (type) {
      case 'bulldozer': return bulldozers;
      case 'scraper': return scrapers;
      case 'loader': return loaders;
      case 'compactor': return compactors;
      default: return [];
    }
  }

  function getById(id) {
    return [...bulldozers, ...scrapers, ...loaders, ...compactors].find(m => m.id === id);
  }

  return { bulldozers, scrapers, loaders, compactors, soilTypes, suggestMachines, suggestRipperBulldozer, getAllByType, getById };
})();
