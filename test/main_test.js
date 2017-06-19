var expect = require('chai').expect;
var assert = require('chai').assert;
// var chai = require('chai');
var main = require('../main')

var testPaths = {
  test_cases: {
    zika: {
      path: './test/data/cases/zika/paho/iso/'
    }
  },
  test_population: './test/data/population/worldpop/',
  test_aegypti: './test/data/aegypti/simon_hay/',
  test_travel: './test/data/amadeus/traffic/country/'
};

var expected_data = {
  population: {
    ecu: [{sum: 17404905, sq_km: 99081}],
    pri: [{sum: 3914878, sq_km: 3463}],
    bra: [{ sum: 209204026, sq_km: 3282025 }]
  },
  mosquito: {
    aegypti: {
      ecu: [{ sum: 0.26646, sq_km: 127895 }],
      pri: [{ sum: 0.67679, sq_km: 4716 }],
      bra: [{ sum: 0.64867, sq_km: 5730002 }]
    }
  },
  cases: {
    zika: {
      bra: { new_cases_this_week: 0, iso_week: '2017-04-24', cases_cumulative: 132021},
      ecu: { new_cases_this_week: 60, iso_week: '2017-04-24', cases_cumulative: 1300 },
      pri: { new_cases_this_week: 78, iso_week: '2017-04-24', cases_cumulative: 40095.71428571428 },
    }
  },
  travels: {
    mex: {
      bra: 6318,
      ecu: 1786,
      pri: 834
    }
  }
}


describe('test data fetching', function() {

  it ('testing getPopulationByKey', function(done) {
    main.getPopulationByKey(testPaths.test_population)
    .then(() => {
      Object.keys(expected_data.population).forEach(country => {
        var country_pop = main.population[country];
        expect(country_pop.sum).to.equal(expected_data.population[country].sum);
        expect(country_pop.sq_km).to.equal(expected_data.population[country].sq_km);
      });
    });
    done();
  })


  it ('testing getMosquito', function(done) {
    main.getMosquito(testPaths.test_aegypti)
    .then(() => {
      Object.keys(expected_data.mosquito.aegypti).forEach(country => {
        var country_pop = main.mosquito.aegypti[country];
        expect(country_pop[0].sum).to.equal(expected_data.mosquito.aegypti[country].sum);
        expect(country_pop[0].sq_km).to.equal(expected_data.mosquito.aegypti[country].sq_km);
      });
    });
    done();
  })


  it ('testing getCases', function(done) {
    main.getCases('zika', testPaths.test_cases.zika.path)
    .then(() => {
      Object.keys(expected_data.cases.zika).forEach(country => {
        var country_pop = main.cases['2017-04-24'][country];
        expect(country_pop.new_cases_this_week).to.equal(expected_data.cases.zika[country].new_cases_this_week);
        expect(country_pop.iso_week).to.equal(expected_data.cases.zika[country].iso_week);
        expect(country_pop.cases_cumulative).to.equal(expected_data.cases.zika[country].cases_cumulative);
      });
    });
    done();
  })

  it ('testing getTravelData', function(done) {
    main.getTravelData(testPaths.test_travel)
    .then(() => {
      Object.keys(expected_data.travels).forEach(country => {
        var country_pop = main.traffic['2017-04-24'][country];
        expect(country_pop.bra).to.equal(expected_data.travels[country].bra);
        expect(country_pop.ecu).to.equal(expected_data.travels[country].ecu);
        expect(country_pop.pri).to.equal(expected_data.travels[country].pri);
      });
    });
    done();
  })
})
