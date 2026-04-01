const ENNorms = (() => {
  const norms = [
    {
      processId: 'topsoil_cut',
      enCode: '2.1.6-04-б',
      name: 'Зрізання рослинного шару ґрунту',
      unitBase: 'м²',
      unitSize: 1000,
      machineDayNorm: 0.1,
      laborDayNorm: 0.16,
      recommendedMachines: ['dz29', 'dz42', 'dz17'],
      source: 'ЕНіР, зб. 2.1, зрізання рослинного шару бульдозером',
      notes: 'Прив’язано до калькуляційної позиції для зрізання рослинного шару бульдозером.'
    },
    {
      processId: 'soil_loosening',
      enCode: '2.1.1-04-в',
      name: 'Розпушування ґрунту',
      unitBase: 'м³',
      unitSize: 100,
      machineDayNorm: 0.11,
      laborDayNorm: 0.17,
      recommendedMachines: ['dp9', 'dp15', 'dp25'],
      source: 'ЕНіР, зб. 2.1, розпушування ґрунту бульдозером-розпушувачем',
      notes: 'Попереднє розпушування виконується бульдозерами-розпушувачами.'
    },
    {
      processId: 'soil_development_move',
      enCode: '2.1.21-02-б',
      name: 'Розроблення та переміщення ґрунту',
      unitBase: 'м³',
      unitSize: 100,
      machineDayNorm: 0.22,
      laborDayNorm: 0.3,
      machineDayByType: {
        bulldozer: 0.26,
        scraper: 0.16,
        loader: 0.22
      },
      laborDayByType: {
        bulldozer: 0.34,
        scraper: 0.22,
        loader: 0.3
      },
      recommendedMachines: ['dz17', 'dz35b', 'dz11p', 'to18', 'to25'],
      source: 'ЕНіР, зб. 2.1, розроблення та переміщення ґрунту землерийно-транспортними машинами',
      notes: 'Базова калькуляційна позиція прив’язана до розроблення і переміщення ґрунту; норма коригується за типом ведучої машини.'
    },
    {
      processId: 'soil_spreading',
      enCode: '2.1.28-06-а',
      name: 'Розрівнювання ґрунту',
      unitBase: 'м³',
      unitSize: 100,
      machineDayNorm: 0.09,
      laborDayNorm: 0.13,
      machineDayByType: {
        bulldozer: 0.08,
        scraper: 0.09,
        loader: 0.1
      },
      laborDayByType: {
        bulldozer: 0.12,
        scraper: 0.13,
        loader: 0.15
      },
      recommendedMachines: ['dz29', 'dz17', 'to18', 'to25'],
      source: 'ЕНіР, зб. 2.1, розрівнювання ґрунту бульдозером',
      notes: 'Розрівнювання насипу приймається за нормами на підчищення і розподіл ґрунту.'
    },
    {
      processId: 'soil_compaction',
      enCode: '2.1.29-01-а',
      name: 'Ущільнення ґрунту',
      unitBase: 'м³',
      unitSize: 100,
      machineDayNorm: 0.07,
      laborDayNorm: 0.1,
      recommendedMachines: ['du16v', 'du31a', 'catCS56B'],
      source: 'ЕНіР, зб. 2.1, ущільнення ґрунту пневмоколісним котком',
      notes: 'Ущільнення виконується котками з нормативним обліком проходок.'
    },
    {
      processId: 'final_grading',
      enCode: '2.1.36-05-б',
      name: 'Остаточне планування майданчика',
      unitBase: 'м²',
      unitSize: 1000,
      machineDayNorm: 0.08,
      laborDayNorm: 0.12,
      recommendedMachines: ['dz29', 'dz42', 'dz17'],
      source: 'ЕНіР, зб. 2.1, остаточне планування майданчика бульдозером',
      notes: 'Чистове планування по всій площі майданчика.'
    }
  ];

  function getByProcessId(processId) {
    return norms.find(norm => norm.processId === processId) || null;
  }

  return {
    norms,
    getByProcessId
  };
})();
