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
  population: './test/data/population/worldbank/',
  aegypti: './test/data/aegypti/simon_hay/',
  travel: './test/data/amadeus/traffic/country/',
  shapefiles: './test/data/shapefiles/gadm2-8/'
};

// expected data of the tests
const expected_data = {
  population: {
      "ecu": {"sum": 16144000, 'sq_km': 256932,},
      "bra": {"sum": 207848000, 'sq_km': 8507128},
      "mex": {"sum": 127017000, 'sq_km': 1962939},
      "pri": {"sum": 3474000, 'sq_km': 9062}
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
        "bra": {
            "new_cases_this_week": {
                "autochthonous_cases_confirmed": 0,
                "imported_cases": 0
            },
            "iso_week": "2017-04-24",
            "cumulative": {
                "autochthonous_cases_confirmed": 132021,
                "imported_cases": 0
            }
        },
        "ecu": {
            "new_cases_this_week": {
                "autochthonous_cases_confirmed": 60.57142857142857,
                "imported_cases": 0
            },
            "iso_week": "2017-04-24",
            "cumulative": {
                "autochthonous_cases_confirmed": 1300,
                "imported_cases": 15
            }
        },
        "mex": {
            "new_cases_this_week": {
                "autochthonous_cases_confirmed": 64.85714285714286,
                "imported_cases": 0
            },
            "iso_week": "2017-04-24",
            "cumulative": {
                "autochthonous_cases_confirmed": 8713,
                "imported_cases": 15
            }
        },
        "pri": {
            "new_cases_this_week": {
                "autochthonous_cases_confirmed": 76.14285714285714,
                "imported_cases": 0
            },
            "iso_week": "2017-04-24",
            "cumulative": {
                "autochthonous_cases_confirmed": 40095.71428571428,
                "imported_cases": 137
            }
          }
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

const countriesList = Object.keys(expected_data.population)

describe('testing data fetching', function() {

  it ('testing getPopulation', (done) => {
    main.getPopulation(testPaths.population)
    .then(population => {
      Object.keys(expected_data.population).forEach(country => {
        var country_pop = population[country];
        expect(country_pop.sum).to.equal(expected_data.population[country].sum);
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
        var country_cases = cases[date][country];

        let new_cases_confirmed = country_cases.new_cases_this_week.autochthonous_cases_confirmed
        let new_cases_imported = country_cases.new_cases_this_week.imported_cases

        let commulative_cases_confirmed = country_cases.cumulative.autochthonous_cases_confirmed
        let commulative_cases_imported = country_cases.cumulative.imported_cases

        expect(new_cases_confirmed).to.equal(expected_data.cases.zika[country].new_cases_this_week.autochthonous_cases_confirmed);

        expect(new_cases_imported).to.equal(expected_data.cases.zika[country].new_cases_this_week.imported_cases);

        expect(commulative_cases_confirmed).to.equal(expected_data.cases.zika[country].cumulative.autochthonous_cases_confirmed);

        expect(commulative_cases_imported).to.equal(expected_data.cases.zika[country].cumulative.imported_cases);
      });
      done();
    });
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
      done();
    });
  })

  it ('testing getArea', (done) => {
    main.getArea(testPaths.shapefiles)
    .then(country_area => {
      Object.keys(country_area).forEach(country => {
        expect(parseInt(country_area[country])).to.equal(expected_data.population[country].sq_km)
        test_population[country].sq_km = country_area[country]
        test_population[country].density = test_population[country].sum / country_area[country]
      })
      done()
    })
  })
})


describe('testing models', () => {

  it('testing all models for zika', (done) => {
    main.getRisk(date, 'zika', test_population, test_mosquito, countriesList, testPaths)
    .then(model => {

      var expected_model = expectedModel()
      var result = model[date]

      expect(result.bra.model_0.score_new).to.equal('NA')
      expect(result.bra.model_0.score_cummulative).to.equal('NA')

      expect(result.mex.model_0.score_new).to.equal(expected_model.model_0.score_new)
      expect(result.mex.model_0.score_cummulative).to.equal(expected_model.model_0.score_cummulative)

      expect(result.mex.model_1.score_new).to.equal(expected_model.model_1.score_new)
      expect(result.mex.model_1.score_cummulative).to.equal(expected_model.model_1.score_cummulative)

      expect(result.mex.model_2.score_new).to.equal(expected_model.model_2.score_new)
      expect(result.mex.model_2.score_cummulative).to.equal(expected_model.model_2.score_cummulative)

      expect(result.mex.model_3.score_new).to.equal(expected_model.model_3.score_new);
      expect(result.mex.model_3.score_cummulative).to.equal(expected_model.model_3.score_cummulative)

      expect(result.mex.model_4.score_new).to.equal(expected_model.model_4.score_new);
      expect(result.mex.model_4.score_cummulative).to.equal(expected_model.model_4.score_cummulative)

      done()
    })
  })
})

/**
 * This function will calculate expected values for all the models.
 * For calculations it will use values from expected_data
 * @return {Object} expected result for all the models
 */
function expectedModel() {
  let model = {model_0: {}, model_1: {}, model_2: {}, model_3: {}, model_4: {}}
  let sum_new = 0;
  let sum_cummulative = 0;

  // calculating the summation
  Object.keys(expected_data.travels.mex).forEach(country => {

    let cases = expected_data.cases.zika[country]

    let new_cases_confirmed = cases.new_cases_this_week.autochthonous_cases_confirmed
    let new_cases_imported = cases.new_cases_this_week.imported_cases
    let total_new_cases = new_cases_imported + new_cases_confirmed

    let commulative_cases_confirmed = cases.cumulative.autochthonous_cases_confirmed
    let commulative_cases_imported = cases.cumulative.imported_cases
    let total_cumm_cases = commulative_cases_imported + commulative_cases_confirmed

    sum_new += ( expected_data.travels.mex[country] * ( total_new_cases / expected_data.population[country].sum ));

    sum_cummulative += ( expected_data.travels.mex[country] * ( total_cumm_cases / expected_data.population[country].sum ));
  })

  // model 0
  model.model_0.score_new = sum_new
  model.model_0.score_cummulative = sum_cummulative

  // calculating model 1
  model.model_1.score_new = sum_new * expected_data.mosquito.aegypti.mex[0].sum;
  model.model_1.score_cummulative = sum_cummulative * expected_data.mosquito.aegypti.mex[0].sum;

  // calculating model 2
  model.model_2.score_new = model.model_1.score_new / expected_data.population.mex.sum
  model.model_2.score_cummulative = model.model_1.score_cummulative / expected_data.population.mex.sum

  // calculating model 3
  model.model_3.score_new = model.model_1.score_new * (expected_data.population.mex.sum / expected_data.population.mex.sq_km)
  model.model_3.score_cummulative = model.model_1.score_cummulative * (expected_data.population.mex.sum / expected_data.population.mex.sq_km)

  // calculating model 4
  let mex_cases = expected_data.cases.zika.mex
  let mex_new_cases = mex_cases.new_cases_this_week.autochthonous_cases_confirmed + mex_cases.new_cases_this_week.imported_cases

  let mex_cumm_cases = mex_cases.cumulative.autochthonous_cases_confirmed + mex_cases.cumulative.imported_cases

  model.model_4.score_new = model.model_1.score_new + ( expected_data.mosquito.aegypti.mex[0].sum * mex_new_cases )

  model.model_4.score_cummulative = model.model_1.score_cummulative + ( expected_data.mosquito.aegypti.mex[0].sum * mex_cumm_cases )

  return model;
}
