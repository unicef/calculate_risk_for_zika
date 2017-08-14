const getConfig = require('./lib/config_helper').getConfig;
const bluebird = require('bluebird');
const async = require('async');
const population_aggregator = require('./lib/population_aggregator');
const fs = bluebird.promisifyAll(require('fs'));
const jsonfile = bluebird.promisify(require('jsonfile').readFile);
const csv = require('csvtojson');
const country_codes = require('./country_codes')

const CONFIRMED = 'autochthonous_cases_confirmed'
const IMPORTED = 'imported_cases'


/**
 * This function will fetch all the data required to calculate risk of an epidemic
 * and will calculate risk using callback function. If callback is not specified it uses calculateRisk
 * @param  {string} date         start date of the week for which risk is calculated
 * @param  {string} disease      name of the disease
 * @param  {object} population   population object
 * @param  {object} mosquito     object with mosquito prevelence
 * @param  {list} countriesList  list of all country-codes
 * @param  {object} in_path      object holding specific paths
 * @return {object} final_model  object holding result of all models
 */
const getRisk = (date, disease, population,
                 mosquito, countriesList, in_path) => {
  return new Promise((resolve, reject) => {
    async.waterfall([
      // get cases of disease specified
      (callback) => {
        const path =
          in_path ? in_path.cases.zika.path :
          getConfig('cases', 'zika').path
        getCases(disease, path, `${date}.json`)
          .then((cases) => {
            callback(null, cases)
          })
          .catch(reject)
      },
      // get travel data
      (cases, callback) => {
        const path = in_path ? in_path.travel : getConfig('travel', 'path')
        getTravelData(path, `${date}.csv`)
          .then((traffic) => {
            callback(null, cases, traffic)
          })
          .catch(reject)
      }
    ], (error, cases, traffic) => {
      const model_0 = calculateRiskByModel0(population, cases,
                                            traffic, countriesList)
      const model_1 = calculateRiskByModel1(model_0, mosquito);
      calculateRiskByModel2(model_1, population);
      calculateRiskByModel3(model_1, population);
      const final_model = calculateRiskByModel4(model_1, mosquito, cases);

      // always resolve last model calculated
      return resolve(final_model);
    })
  });
}


/**
 * Function to fetch population and fill in population object
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
const getPopulation = (path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('population', 'default_source')
    }
    jsonfile(`${path}population.json`)
      .then(resolve)
      .catch(reject)
  })
}

/**
 * Function to fetch mosquito prevelence (for now just aegypti) and fill in mosquito object
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
const getMosquito = (path) => {
  return new Promise((resolve, reject) => {
    population_aggregator.getPopulationByKey('aegypti', path)
      .then((content) => {
        return resolve({ aegypti: content });
      })
      .catch((error) => {
        console.log('Error!', error);
        return reject(error)
      })
  });
}

/**
* Function to fetch travel data and fill in traffic object
* @param  {String} path       path of input folder
* @param {String} fileName   Name of the file with travel data (first of the week)
* @return {Promise} Fulfilled when records are returned
 */
let getTravelData = (path, fileName) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('travel', 'path')
    }
    const date = fileName.split('.')[0];
    const traffic = {}
    traffic[date] = {};
    aggregateTravels(fileName, date, path)
      .then(resolve)
      .catch((error) => {
        console.log('Error in fetching travel data', error);
        return reject(error);
      });
  });
}

/**
 * This function will read a CSV file having travel data and will store the data in format:
 * { dest: { orig: <count of people travelling from orig to dest> } }
 * @param  {String} fileName name if the file to read
 * @param  {String} date     date for which the data is read
 * @param  {String} path     path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let aggregateTravels = (fileName, date, path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('travel', 'path')
    }
    const traffic = {}
    traffic[date] = {}
    fs.readFileAsync(path + fileName, 'utf8')
      .then((content) => {
        csv({ flatKeys: true })
          .fromString(content)
          .on('json', (trip) => {
            let orig = country_codes[trip.orig];
            let dest = country_codes[trip.dest];
            if (orig !== undefined && dest !== undefined) {
              dest = dest.toLowerCase();
              orig = orig.toLowerCase();
              if (dest in traffic[date]) {
                traffic[date][dest][orig] = trip.cnt;
              } else {
                traffic[date][dest] = {};
                traffic[date][dest][orig] = trip.cnt;
              }
            }
          })
          .on('done', (error) => {
            if (error) {
              return reject(error)
            }
            return resolve(traffic)
          })
      });
  });
}

/**
 * Function to fetch cases and fill in cases object
 * @param  {String} disease name of the disease
 * @param  {String} path     path of input folder
 * @param  {String} file    name if the file to read
 * @return {Promise} Fulfilled when records are returned
 */
let getCases = (disease, path, file) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('cases', disease).path
    }
    readCaseFile(disease, file, path)
      .then((content) => {
        return resolve(content)
      })
      .catch((error) => {
        console.log('Error!', error);
        return reject(error);
      })
  });
}

/**
 * This function will read a JSON file holding cases of specified disease
 * @param  {String} disease name of the disease
 * @param  {String} file    name if the file to read
 * @param  {String} path     path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let readCaseFile = (disease, file, path) => {
  return new Promise((resolve, reject) => {
    const date = file.split('.')[0];
    const cases = {}
    cases[date] = {}
    if (path === undefined) {
      path = getConfig('cases', disease).path
    }
    jsonfile(path + file)
      .then((content) => {
        Object.assign(cases[date], content.countries);
        return resolve(cases);
      })
      .catch((error) => {
        return reject(error);
      })
  });
}


/**
 * This function will return area in square kilometers for all available countries
 * @param  {String} path     path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
const getArea = (path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('shape_files')
    }
    fs.readdirAsync(path)
      .then((countries) => {
        bluebird.reduce(countries, (country_area, country) => {
          return getAreaFromShapeFile(path, country)
            .then((data) => {
              country_area[data.key] = data.area
              return country_area
            })
        }, {})
          .then((country_area) => {
            return resolve(country_area)
          })
          .catch(reject)
      })
  });
}


/**
 * This function will return area of specified country in square kilometers
 * @param  {String} path     path of input folder
 * @param {String} country  Country for which we are fetching area
 * @return {Promise} Fulfilled when records are returned
 */
const getAreaFromShapeFile = (path, country) => {
  return new Promise((resolve, reject) => {
    let key, area
    fs.readFileAsync(`${path + country}/${country}_adm0.csv`, 'utf8')
      .then((content) => {
        csv()
          .fromString(content)
          .on('json', (jsonData) => {
            key = jsonData.ISO.toLowerCase()
            area = parseInt(jsonData.SQKM)
          })
          .on('done', (error) => {
            if (error) {
              return reject(error)
            }
            return resolve({ key, area })
          })
      })
  });
}


/**
 * This function returns estimated number of imported cases based on
 * number of people travelling to a country, number of zika cases in origin country
 * and population of origin country
 * @param  {String} country    Destination country
 * @param  {Object} population Population
 * @param  {Object} curr_cases Zika cases
 * @param  {Object} traffic    Object holding number of people travelling to
 *                             destination country from other countries
 * @return {Object}            Object with estimated new and cummulative cases
 */
const getImportedCases = (country, population, curr_cases, traffic) => {
  // let new_cases = 0, cumm_cases = 0
  const cases = { new_cases: 0, cumm_cases: 0 }
  Object.keys(traffic).forEach((orig) => {
    if (orig in curr_cases && orig in population && orig !== country) {
      const new_cases = curr_cases[orig].new_cases_this_week
      const total_new_cases = new_cases[CONFIRMED] + new_cases[IMPORTED];

      const cumm_cases = curr_cases[orig].cumulative;
      const total_cumm_cases = cumm_cases[CONFIRMED] + cumm_cases[IMPORTED];

      const population_of_j = population[orig].sum;
      const travellers = traffic[orig];

      cases.new_cases += (total_new_cases / population_of_j) * travellers;
      cases.cumm_cases += (total_cumm_cases / population_of_j) * travellers;
    }
  })

  // return { new_cases, cumm_cases }
  return cases
}


/**
* calculates risk of disease using model zero specified in the document
* @param  {object} population   population object
* @param  {obejct} cases        case data
* @param  {object} traffic      travel data
* @param  {list} countriesList  list of all country-codes
* @return {Object} risk using model zero for each country
 */
const calculateRiskByModel0 = (population, cases, traffic, countriesList) => {
  const return_val = {};
  Object.keys(cases).forEach((case_date) => {
    if (case_date in traffic) {
      const curr_cases = cases[case_date];
      const travellers = traffic[case_date];
      const zika_risk = {};
      countriesList.forEach((country) => {
        zika_risk[country] = {}
        zika_risk[country].model_0 = {}

        if (country in travellers) {
          const importedCases = getImportedCases(country, population,
                                                 curr_cases,
                                                 travellers[country])
          zika_risk[country].model_0 = {
            score_new: importedCases.new_cases,
            score_cummulative: importedCases.cumm_cases
          }
        } else {
          zika_risk[country].model_0.score_new = 'NA'
          zika_risk[country].model_0.score_cummulative = 'NA'
        }
      })
      return_val[case_date] = {};
      Object.assign(return_val[case_date], zika_risk);
    }
  })
  return return_val
}

/**
 * calculates risk of disease using first model specified in the document
 * @param  {object} model_0  result of model 0
 * @param  {object} mosquito mosquito prevelence
 * @return {Object} risk using first model for each country
 */
let calculateRiskByModel1 = (model_0, mosquito) => {
  Object.keys(model_0).forEach((case_date) => {
    Object.keys(model_0[case_date]).forEach((country) => {
      const model_1 = {}
      const model_0_for_country = model_0[case_date][country].model_0
      if (mosquito.aegypti[country] === undefined ||
          model_0_for_country.score_new === 'NA') {
        model_1.score_new = 'NA'
        model_1.score_cummulative = 'NA'
      } else {
        model_1.score_new =
        model_0_for_country.score_new * mosquito.aegypti[country][0].sum

        model_1.score_cummulative =
        model_0_for_country.score_cummulative * mosquito.aegypti[country][0].sum
      }
      model_0[case_date][country].model_1 = {
        score_new: model_1.score_new,
        score_cummulative: model_1.score_cummulative
      }
    })
  })
  return model_0
}


/**
* calculates risk of disease using second model specified in the document
* @param  {object} model_1    result of model 1
* @param  {object} population population object
* @return {Object} risk using second model for each country
 */
let calculateRiskByModel2 = (model_1, population) => {
  Object.keys(model_1).forEach((case_date) => {
    Object.keys(model_1[case_date]).forEach((country) => {
      const model_2 = {}
      const model_1_for_country = model_1[case_date][country].model_1
      if (population[country] === undefined ||
        model_1_for_country.score_new === 'NA') {
        model_2.score_new = 'NA'
        model_2.score_cummulative = 'NA'
      } else {
        model_2.score_new =
        model_1_for_country.score_new / population[country].sum

        model_2.score_cummulative =
        model_1_for_country.score_cummulative / population[country].sum
      }
      model_1[case_date][country].model_2 = {
        score_new: model_2.score_new,
        score_cummulative: model_2.score_cummulative
      }
    })
  })
  return model_1;
}


/**
* calculates risk of disease using third model specified in the document
* @param  {object} model_1    result of model 1
* @param  {object} population population object
* @return {Object} model_3           risk using third model for each country
 */
let calculateRiskByModel3 = (model_1, population) => {
  Object.keys(model_1).forEach((case_date) => {
    Object.keys(model_1[case_date]).forEach((country) => {
      const model_3 = {}
      const model_1_for_country = model_1[case_date][country].model_1
      if (population[country] === undefined ||
          model_1_for_country.score_new === 'NA'
      ) {
        model_3.score_new = 'NA'
        model_3.score_cummulative = 'NA'
      } else if (!(isNaN(population[country].density))) {
        model_3.score_new =
        model_1_for_country.score_new * population[country].density;

        model_3.score_cummulative =
        model_1_for_country.score_cummulative * population[country].density;
      } else {
        model_1[case_date][country].model_3.score_new = 'NA'
        model_1[case_date][country].model_3.score_cummulative = 'NA'
      }
      model_1[case_date][country].model_3 = {
        score_new: model_3.score_new,
        score_cummulative: model_3.score_cummulative
      }
    })
  })
  return model_1;
}

/**
 * calculates risk of disease using forth model specified in the document
 * @param  {Object} model_1  result of model 1
 * @param  {Object} mosquito mosquito prevelence
 * @param  {Object} cases    cases
 * @return {Object} model_4  risk using third model for each country
 */
let calculateRiskByModel4 = (model_1, mosquito, cases) => {
  Object.keys(model_1).forEach((case_date) => {
    Object.keys(model_1[case_date]).forEach((country) => {
      const model_4 = {}
      const model_1_for_country = model_1[case_date][country].model_1
      if (model_1_for_country.score_new === 'NA' ||
        cases[case_date][country] === undefined ||
        mosquito.aegypti[country] === undefined) {
        model_4.score_new = 'NA'
        model_4.score_cummulative = 'NA'
      } else {
        const new_cases = cases[case_date][country].new_cases_this_week
        const cumm_cases = cases[case_date][country].cumulative

        const total_new_cases = new_cases[CONFIRMED] + new_cases[IMPORTED]
        const total_cumm_cases = cumm_cases[CONFIRMED] + cumm_cases[IMPORTED]

        const mosquitoPrev = mosquito.aegypti[country][0].sum

        const existingScoreNew = mosquitoPrev * total_new_cases
        const existingScoreCumm = mosquitoPrev * total_cumm_cases

        model_4.score_new = model_1_for_country.score_new + existingScoreNew

        model_4.score_cummulative =
        model_1_for_country.score_cummulative + existingScoreCumm
      }

      model_1[case_date][country].model_4 = {
        score_new: model_4.score_new,
        score_cummulative: model_4.score_cummulative
      }
    })
  })
  return model_1
}


module.exports = {
  getPopulation,
  getMosquito,
  getArea,
  getTravelData,
  getCases,
  getRisk
}
