const expect = require('chai').expect;
const assert = require('chai').assert;
// var chai = require('chai');
const main = require('../calculate_risk')
const bluebird = require('bluebird');
const fs = require('fs');
let calculateRisk, model_1;

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
    .then(() => {
      Object.keys(expected_data.population).forEach(country => {
        var country_pop = main.population[country];
        expect(country_pop.sum).to.equal(expected_data.population[country].sum);
        expect(country_pop.sq_km).to.equal(expected_data.population[country].sq_km);
      });
    });
    done();
  })


  it ('testing getMosquito', (done) => {
    main.getMosquito(testPaths.aegypti)
    .then(() => {
      Object.keys(expected_data.mosquito.aegypti).forEach(country => {
        var country_pop = main.mosquito.aegypti[country];
        expect(country_pop.sum).to.equal(expected_data.mosquito.aegypti[country].sum);
        expect(country_pop.sq_km).to.equal(expected_data.mosquito.aegypti[country].sq_km);
      });
    });
    done();
  })


  it ('testing getCases', (done) => {
    main.getCases('zika', testPaths.cases.zika.path)
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

  it ('testing getTravelData', (done) => {
    main.getTravelData(testPaths.travel)
    .then(() => {
      Object.keys(expected_data.travels).forEach(country => {
        var country_pop = main.traffic['2017-04-24'][country];
        expect(parseInt(country_pop.bra)).to.equal(expected_data.travels[country].bra);
        expect(parseInt(country_pop.ecu)).to.equal(expected_data.travels[country].ecu);
        expect(parseInt(country_pop.pri)).to.equal(expected_data.travels[country].pri);
      });
    });
    done();
  })
})


describe('testing models', () => {

  before(() => {
    calculateRisk = bluebird.promisify(main.getRisk);
  })

  it('testing model 1', (done) => {
    calculateRisk('zika', testPaths)
    .then((err, result) => {
      var calculated_model_1 = main.calculateRiskByModel1()['2017-04-24'];
      var expected_model_1 = expectedModel1();

      expect(calculated_model_1.mex.model_1.score_new).to.equal(expected_model_1.model_1_score_new);
      expect(calculated_model_1.mex.model_1.score_cummulative).to.equal(expected_model_1.model_1_score_cummulative);
      model_1 = calculated_model_1;
    })
    done();
  })


  it('testing model 2', (done) => {
    calculateRisk('zika', testPaths)
    .then((err, result) => {
      var calculated_model_1 = main.calculateRiskByModel1();
      var calculated_model_2 = main.calculateRiskByModel2(calculated_model_1)['2017-04-24'];
      var expected_model_2 = expectedModel2(model_1);

      expect(calculated_model_2.mex.model_2.score_new).to.equal(expected_model_2.model_2_score_new);
      expect(calculated_model_2.mex.model_2.score_cummulative).to.equal(expected_model_2.model_2_score_cummulative);
    })
    done();
  })

  it('testing model 3', (done) => {
    calculateRisk('zika', testPaths)
    .then((err, result) => {
      var calculated_model_1 = main.calculateRiskByModel1();
      var calculated_model_3 = main.calculateRiskByModel3(calculated_model_1)['2017-04-24'];
      var expected_model_3 = expectedModel3(model_1);

      expect(calculated_model_3.mex.model_3.score_new).to.equal(expected_model_3.model_3_score_new);
      expect(calculated_model_3.mex.model_3.score_cummulative).to.equal(expected_model_3.model_3_score_cummulative);
    })
    done();
  })
})

const expectedModel1 = () => {
  let model_1 = {}
  let sum_new = 0;
  let sum_cummulative = 0;
  Object.keys(expected_data.travels.mex).forEach(country => {
    sum_new += ( expected_data.travels.mex[country] * ( expected_data.cases.zika[country].new_cases_this_week / expected_data.population[country][0].sum ));

    sum_cummulative += ( expected_data.travels.mex[country] * ( expected_data.cases.zika[country].cases_cumulative / expected_data.population[country][0].sum ));
  })

  model_1.model_1_score_new = sum_new * expected_data.mosquito.aegypti.mex[0].sum;
  model_1.model_1_score_cummulative = sum_cummulative * expected_data.mosquito.aegypti.mex[0].sum;

  return model_1;
}


const expectedModel3 = (model_1) => {
  let model_3 = {}

  model_3.model_3_score_new = model_1.mex.model_1.score_new * expected_data.population.mex[0].sum * expected_data.population.mex[0].sq_km;
  model_3.model_3_score_cummulative = model_1.mex.model_1.score_cummulative * expected_data.population.mex[0].sum * expected_data.population.mex[0].sq_km;

  return model_3;
}

const expectedModel2 = (model_1) => {
  let model_2 = {}

  model_2.model_2_score_new = model_1.mex.model_1.score_new / expected_data.population.mex[0].sum;
  model_2.model_2_score_cummulative = model_1.mex.model_1.score_cummulative / expected_data.population.mex[0].sum;

  return model_2;
}
