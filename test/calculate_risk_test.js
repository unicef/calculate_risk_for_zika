const expect = require('chai').expect;
const assert = require('chai').assert;
const main = require('../calculate_risk')
const bluebird = require('bluebird');
const fs = require('fs');
let test_population, test_mosquito;

const date = '2017-04-24'

// path of folders holding test data
const testPaths = {
  cases: {
    zika: {
      path: './test/data/cases/zika/paho/iso/'
    }
  },
  population: './test/data/population/worldpop/',
  aegypti: './test/data/aegypti/simon_hay/',
  travel: './test/data/amadeus/traffic/country/'
};

// expected data of the tests
const expected_data = {
  population: {
    ecu: [{sum: 17404905, sq_km: 99081}],
    pri: [{sum: 3914878, sq_km: 3463}],
    bra: [{ sum: 209204026, sq_km: 3282025 }],
    mex: [{ sum:146308931, sq_km: 753684}]
  },
  mosquito: {
    aegypti: {
      ecu: [{ sum: 0.26646, sq_km: 127895 }],
      pri: [{ sum: 0.67679, sq_km: 4716 }],
      bra: [{ sum: 0.64867, sq_km: 5730002 }],
      mex: [{ sum: 0.41478, sq_km: 1159804 }]
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


describe('testing data fetching', function() {

  it ('testing getPopulationByKey', (done) => {
    main.getPopulationByKey(testPaths.population)
    .then(population => {
      Object.keys(expected_data.population).forEach(country => {
        var country_pop = population[country];
        expect(country_pop.sum).to.equal(expected_data.population[country].sum);
        expect(country_pop.sq_km).to.equal(expected_data.population[country].sq_km);
      });
      test_population = population
    });
    done();
  })


  it ('testing getMosquito', (done) => {
    main.getMosquito(testPaths.aegypti)
    .then(mosquito => {
      Object.keys(expected_data.mosquito.aegypti).forEach(country => {
        var country_pop = mosquito.aegypti[country];
        expect(country_pop.sum).to.equal(expected_data.mosquito.aegypti[country].sum);
        expect(country_pop.sq_km).to.equal(expected_data.mosquito.aegypti[country].sq_km);
      });
      test_mosquito = mosquito
    });
    done();
  })


  it ('testing getCases', (done) => {
    main.getCases('zika', testPaths.cases.zika.path, `${date}.json`)
    .then(cases => {

      Object.keys(expected_data.cases.zika).forEach(country => {
        var country_pop = cases[date][country];
        expect(country_pop.new_cases_this_week).to.equal(expected_data.cases.zika[country].new_cases_this_week);
        expect(country_pop.iso_week).to.equal(expected_data.cases.zika[country].iso_week);
        expect(country_pop.cases_cumulative).to.equal(expected_data.cases.zika[country].cases_cumulative);
      });
    });
    done();
  })

  it ('testing getTravelData', (done) => {
    main.getTravelData(testPaths.travel, `${date}.csv`)
    .then(traffic => {
      Object.keys(expected_data.travels).forEach(country => {
        var country_pop = traffic['2017-04-24'][country];
        expect(parseInt(country_pop.bra)).to.equal(expected_data.travels[country].bra);
        expect(parseInt(country_pop.ecu)).to.equal(expected_data.travels[country].ecu);
        expect(parseInt(country_pop.pri)).to.equal(expected_data.travels[country].pri);
      });
    });
    done();
  })
})


describe('testing models', () => {

  it('testing all models for zika', (done) => {
    main.getRisk(date, 'zika', test_population, test_mosquito, testPaths)
    .then(model => {

      var expected_model = expectedModel()
      var result = model[date]

      expect(result.mex.model_1.score_new).to.equal(expected_model.model_1.score_new);
      expect(result.mex.model_1.score_cummulative).to.equal(expected_model.model_1.score_cummulative);

      expect(result.mex.model_2.score_new).to.equal(expected_model.model_2.score_new);
      expect(result.mex.model_2.score_cummulative).to.equal(expected_model.model_2.score_cummulative);

      expect(result.mex.model_3.score_new).to.equal(expected_model.model_3.score_new);
      expect(result.mex.model_3.score_cummulative).to.equal(expected_model.model_3.score_cummulative);
    })
    done();
  })
})

/**
 * This function will calculate expected values for all the models.
 * For calculations it will use values from expected_data
 * @return {Object} expected result for all the models
 */
function expectedModel() {
  let model = {model_1: {}, model_2: {}, model_3: {}}
  let sum_new = 0;
  let sum_cummulative = 0;

  // calculating the summation
  Object.keys(expected_data.travels.mex).forEach(country => {
    sum_new += ( expected_data.travels.mex[country] * ( expected_data.cases.zika[country].new_cases_this_week / expected_data.population[country][0].sum ));

    sum_cummulative += ( expected_data.travels.mex[country] * ( expected_data.cases.zika[country].cases_cumulative / expected_data.population[country][0].sum ));
  })

  // calculating model 1
  model.model_1.score_new = sum_new * expected_data.mosquito.aegypti.mex[0].sum;
  model.model_1.score_cummulative = sum_cummulative * expected_data.mosquito.aegypti.mex[0].sum;

  // calculating model 2
  model.model_2.score_new = model.model_1.score_new / expected_data.population.mex[0].sum
  model.model_2.score_cummulative = model.model_1.score_cummulative / expected_data.population.mex[0].sum

  // calculating model 3
  model.model_3.score_new = model.model_1.score_new * (expected_data.population.mex[0].sum / expected_data.population.mex[0].sq_km)
  model.model_3.score_cummulative = model.model_1.score_cummulative * (expected_data.population.mex[0].sum / expected_data.population.mex[0].sq_km)

  return model;
}
