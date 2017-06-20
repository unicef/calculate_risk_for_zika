module.exports = {
  cases: {
    zika: {
      path: '../mnt/cases/zika/paho/iso/',
      test_path: './test/data/cases/zika/paho/iso/',
      format: 'json'
    }
  },
  travel: {
    path: '../mnt/mobility/amadeus/traffic/country/',
    test_path: './test/data/amadeus/traffic/country/',
    format: '.csv'
  },
  population: {
    path: '../mnt/population/worldpop/',
    test_path: './test/data/population/worldpop/',
    format: 'json'
  },
  aegypti: {
    path: '../mnt/aegypti/simon_hay/',
    test_path: './test/data/aegypti/simon_hay/',
    format: 'json'
  },
  albopictus: {
    path: '../mnt/albopictus/simon_hay/',
    test_path: './test/data/albopictus/simon_hay/',
    format: 'json'
  },
  output_path : '../mnt/risk/'
};
