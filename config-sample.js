module.exports = {
  cases: {
    zika: {
      dir: 'aggregations',
      path: 'cases/zika/paho/iso',
      format: 'json',
      url: 'cases/zika/paho/iso/',
      fs_dir: '../mnt/cases/zika/paho/iso/'
    }
  },
  travel: {
    dir: 'aggregations',
    path: '../mnt/mobility/amadeus/traffic/country/',
    format: '.csv'
  },
  population: {
    dir: 'aggregations',
    path: '../mnt/population/worldpop/',
    format: 'json'
  },
  // mosquito: {
  //   aegypti: {
  //     dir: 'aggregations',
  //     path: '../mnt/aegypti/simon_hay/',
  //     format: 'json'
  //   },
  //   albopictus: {
  //     dir : 'aggregations',
  //     path: '../mnt/albopictus/simon_hay/',
  //     format: 'json'
  //   }
  // },
  aegypti: {
    dir: 'aggregations',
    path: '../mnt/aegypti/simon_hay/',
    format: 'json'
  },
  albopictus: {
    dir : 'aggregations',
    path: '../mnt/albopictus/simon_hay/',
    format: 'json'
  },
  output_path : '../mnt/risk/'
};
