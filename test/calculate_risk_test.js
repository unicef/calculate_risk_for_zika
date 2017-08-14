const chai = require('chai');
const main = require('../calculate_risk')

let test_population, test_mosquito;

const date = '2017-04-24'
const CONFIRMED = 'autochthonous_cases_confirmed'
const IMPORTED = 'imported_cases'

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
    ecu: { sum: 16144000, sq_km: 256932 },
    bra: { sum: 207848000, sq_km: 8507128 },
    mex: { sum: 127017000, sq_km: 1962939 },
    pri: { sum: 3474000, sq_km: 9062 }
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
      bra: {
        new_cases_this_week: {
          autochthonous_cases_confirmed: 0,
          imported_cases: 0
        },
        iso_week: '2017-04-24',
        cumulative: {
          autochthonous_cases_confirmed: 132021,
          imported_cases: 0
        }
      },
      ecu: {
        new_cases_this_week: {
          autochthonous_cases_confirmed: 60.57142857142857,
          imported_cases: 0
        },
        iso_week: '2017-04-24',
        cumulative: {
          autochthonous_cases_confirmed: 1300,
          imported_cases: 15
        }
      },
      mex: {
        new_cases_this_week: {
          autochthonous_cases_confirmed: 64.85714285714286,
          imported_cases: 0
        },
        iso_week: '2017-04-24',
        cumulative: {
          autochthonous_cases_confirmed: 8713,
          imported_cases: 15
        }
      },
      pri: {
        new_cases_this_week: {
          autochthonous_cases_confirmed: 76.14285714285714,
          imported_cases: 0
        },
        iso_week: '2017-04-24',
        cumulative: {
          autochthonous_cases_confirmed: 40095.71428571428,
          imported_cases: 137
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

describe('testing data fetching', () => {
  it('testing getPopulation', (done) => {
    main.getPopulation(testPaths.population)
      .then((population) => {
        Object.keys(expected_data.population).forEach((country) => {
          const country_pop = population[country];
          chai.expect(country_pop.sum)
            .to.equal(expected_data.population[country].sum);
        });
        test_population = population
      });
    done();
  })


  it('testing getMosquito', (done) => {
    main.getMosquito(testPaths.aegypti)
      .then((mosquito) => {
        Object.keys(expected_data.mosquito.aegypti).forEach((country) => {
          const country_pop = mosquito.aegypti[country];
          chai.expect(country_pop.sum)
            .to.equal(expected_data.mosquito.aegypti[country].sum);

          chai.expect(country_pop.sq_km)
            .to.equal(expected_data.mosquito.aegypti[country].sq_km);
        });
        test_mosquito = mosquito
      });
    done();
  })


  it('testing getCases', (done) => {
    main.getCases('zika', testPaths.cases.zika.path, `${date}.json`)
      .then((cases) => {
        const expected_cases = expected_data.cases.zika
        Object.keys(expected_cases).forEach((country) => {
          const new_cases = cases[date][country].new_cases_this_week;
          const cummulative_cases = cases[date][country].cumulative

          const new_cases_confirmed = new_cases[CONFIRMED]

          const new_cases_imported = new_cases[IMPORTED]

          const commulative_cases_confirmed = cummulative_cases[CONFIRMED]
          const commulative_cases_imported = cummulative_cases[IMPORTED]

          chai.expect(new_cases_confirmed)
            .to.equal(expected_cases[country].new_cases_this_week[CONFIRMED]);

          chai.expect(new_cases_imported)
            .to.equal(expected_cases[country].new_cases_this_week[IMPORTED]);

          chai.expect(commulative_cases_confirmed)
            .to.equal(expected_cases[country].cumulative[CONFIRMED]);

          chai.expect(commulative_cases_imported)
            .to.equal(expected_cases[country].cumulative[IMPORTED]);
        });
        done();
      });
  })

  it('testing getTravelData', (done) => {
    main.getTravelData(testPaths.travel, `${date}.csv`)
      .then((traffic) => {
        Object.keys(expected_data.travels).forEach((country) => {
          const country_pop = traffic['2017-04-24'][country];
          chai.expect(parseInt(country_pop.bra))
            .to.equal(expected_data.travels[country].bra);

          chai.expect(parseInt(country_pop.ecu))
            .to.equal(expected_data.travels[country].ecu);

          chai.expect(parseInt(country_pop.pri))
            .to.equal(expected_data.travels[country].pri);
        });
        done();
      });
  })

  it('testing getArea', (done) => {
    main.getArea(testPaths.shapefiles)
      .then((country_area) => {
        Object.keys(country_area).forEach((country) => {
          chai.expect(parseInt(country_area[country]))
            .to.equal(expected_data.population[country].sq_km)

          test_population[country].sq_km = country_area[country]

          test_population[country].density =
          test_population[country].sum / country_area[country]
        })
        done()
      })
  })
})


describe('testing models', () => {
  it('testing all models for zika', (done) => {
    main.getRisk(date, 'zika', test_population,
                 test_mosquito, countriesList, testPaths)
      .then((model) => {
        const expected_model = expectedModel()
        const result = model[date]

        chai.expect(result.bra.model_0.score_new).to.equal('NA')
        chai.expect(result.bra.model_0.score_cummulative).to.equal('NA')

        chai.expect(result.mex.model_0.score_new)
          .to.equal(expected_model.model_0.score_new)

        chai.expect(result.mex.model_0.score_cummulative)
          .to.equal(expected_model.model_0.score_cummulative)

        chai.expect(result.mex.model_1.score_new)
          .to.equal(expected_model.model_1.score_new)

        chai.expect(result.mex.model_1.score_cummulative)
          .to.equal(expected_model.model_1.score_cummulative)

        chai.expect(result.mex.model_2.score_new)
          .to.equal(expected_model.model_2.score_new)

        chai.expect(result.mex.model_2.score_cummulative)
          .to.equal(expected_model.model_2.score_cummulative)

        chai.expect(result.mex.model_3.score_new)
          .to.equal(expected_model.model_3.score_new);

        chai.expect(result.mex.model_3.score_cummulative)
          .to.equal(expected_model.model_3.score_cummulative)

        chai.expect(result.mex.model_4.score_new)
          .to.equal(expected_model.model_4.score_new);

        chai.expect(result.mex.model_4.score_cummulative)
          .to.equal(expected_model.model_4.score_cummulative)

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
  const model = {
    model_0: {},
    model_1: {},
    model_2: {},
    model_3: {},
    model_4: {}
  }
  let sum_new = 0;
  let sum_cummulative = 0;

  // calculating the summation
  Object.keys(expected_data.travels.mex).forEach((country) => {
    const cases = expected_data.cases.zika[country]

    const new_cases_confirmed = cases.new_cases_this_week[CONFIRMED]
    const new_cases_imported = cases.new_cases_this_week[IMPORTED]
    const total_new_cases = new_cases_imported + new_cases_confirmed

    const commulative_cases_confirmed = cases.cumulative[CONFIRMED]
    const commulative_cases_imported = cases.cumulative[IMPORTED]

    const total_cumm_cases =
    commulative_cases_imported + commulative_cases_confirmed

    const temp_new_sum = total_new_cases / expected_data.population[country].sum
    sum_new += (expected_data.travels.mex[country] * temp_new_sum);

    const temp_new_cumm =
    total_cumm_cases / expected_data.population[country].sum

    sum_cummulative += (expected_data.travels.mex[country] * temp_new_cumm);
  })

  const mosquitoPrev = expected_data.mosquito.aegypti.mex[0].sum
  const mexPopulation = expected_data.population.mex.sum
  const mexDensity = mexPopulation / expected_data.population.mex.sq_km

  // model 0
  model.model_0.score_new = sum_new
  model.model_0.score_cummulative = sum_cummulative

  // calculating model 1
  model.model_1.score_new = sum_new * mosquitoPrev;
  model.model_1.score_cummulative = sum_cummulative * mosquitoPrev;

  // calculating model 2
  model.model_2.score_new = model.model_1.score_new / mexPopulation

  model.model_2.score_cummulative =
  model.model_1.score_cummulative / mexPopulation

  // calculating model 3
  model.model_3.score_new = model.model_1.score_new * (mexDensity)

  model.model_3.score_cummulative =
  model.model_1.score_cummulative * (mexDensity)

  // calculating model 4
  // const mex_cases = expected_data.cases.zika.mex
  // const mex_new_cases = mex_cases.new_cases_this_week[CONFIRMED] + mex_cases.new_cases_this_week[IMPORTED]

  const mex_new_cases = expected_data.cases.zika.mex.new_cases_this_week
  const mex_total_new_cases = mex_new_cases[CONFIRMED] + mex_new_cases[IMPORTED]

  const mex_cumm_cases = expected_data.cases.zika.mex.cumulative

  const mex_total_cumm_cases =
  mex_cumm_cases[CONFIRMED] + mex_cumm_cases[IMPORTED]

  model.model_4.score_new =
  model.model_1.score_new + (mosquitoPrev * mex_total_new_cases)

  model.model_4.score_cummulative =
  model.model_1.score_cummulative + (mosquitoPrev * mex_total_cumm_cases)

  return model;
}
