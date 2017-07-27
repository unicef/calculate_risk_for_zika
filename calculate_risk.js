const getConfig = require('./lib/config_helper').getConfig;
const bluebird = require('bluebird');
const async = require('async');
const population_aggregator = require('./lib/population_aggregator');
const fs = bluebird.promisifyAll(require('fs'));
const jsonfile = bluebird.promisify(require('jsonfile').readFile);
const csv = require('csvtojson');
const country_codes = require('./country_codes');

/**
 * This function will fetch all the data required to calculate risk of an epidemic
 * and will calculate risk using callback function. If callback is not specified it uses calculateRisk
 * @param  {String}   disease  name of disease
 * @param  {Object}   in_path  input paths for all data elements
 * @param  {Function} callback callback function to calculate risk
 */
// let getRisk = (date, disease, in_path) => {
  let getRisk = (date, disease, population, mosquito, countriesList, in_path) => {
  return new Promise((resolve, reject) => {
    async.waterfall([
      // get cases of disease specified
      (callback) => {
        let path = in_path ? in_path.cases.zika.path : getConfig('cases', 'zika').path
        getCases(disease, path, `${date}.json`)
        .then(cases => {
          callback(null, cases)
        });
      },
      // get travel data
      (cases, callback) => {
        let path = in_path ? in_path.travel : getConfig('travel', 'path')
        getTravelData(path, `${date}.csv`)
        .then(traffic => {
          callback(null, population, mosquito, cases, traffic, countriesList)
        });
      }
    ], (error, population, mosquito, cases, traffic, countriesList) => {

      let model_0 = calculateRiskByModel0(population, cases, traffic, countriesList)
      let model_1 = calculateRiskByModel1(model_0, mosquito);
      calculateRiskByModel2(model_1, population);
      calculateRiskByModel3(model_1, population);
      let final_model = calculateRiskByModel4(model_1, mosquito, cases);

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
let getPopulation = (path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('population', 'default_source')
    }
    jsonfile(path + 'population.json')
    .then(resolve)
  })
}

/**
 * Function to fetch mosquito prevelence (for now just aegypti) and fill in mosquito object
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getMosquito = (path) => {
  return new Promise((resolve, reject) => {
    population_aggregator.getPopulationByKey('aegypti', path)
    .then(content => {
      return resolve({aegypti: content});
    })
    .catch(error => {
      console.log('Error!', error);
    })
  });
}

/**
 * Function to fetch travel data and fill in traffic object
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getTravelData = (path, fileName) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('travel', 'path')
    }
    let date = fileName.split('.')[0];
    var traffic = {}
    traffic[date] = {};
    aggregateTravels(fileName, date, path)
    .then(resolve)
    .catch(error => {
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
    var traffic = {}
    traffic[date] = {}
    fs.readFileAsync(path + fileName, 'utf8')
    .then(content => {
      csv({flatKeys:true})
      .fromString(content)
      .on('json',(trip)=>{
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
      .on('done', () => {return resolve(traffic)});
    });
  });
}

/**
 * Function to fetch cases and fill in cases object
 * @param  {String} disease name of the disease
 * @param  {String} path     path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getCases = (disease, path, file) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('cases', disease).path
    }
    readCaseFile(disease, file, path)
    .then(content => {
      return resolve(content)
    })
    .catch(error => {
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
    var cases = {}
    cases[date] = {}
    if (path === undefined) {
      path = getConfig('cases', disease).path
    }
    jsonfile(path + file)
    .then(content => {
      Object.assign(cases[date], content.countries);
      return resolve(cases);
    })
    .catch(error => {
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
    .then(countries => {
      bluebird.reduce(countries, (country_area, country) => {
        return getAreaFromShapeFile(path, country)
        .then(data => {
          country_area[data.key] = data.area
          return country_area
        })
      }, {})
      .then(country_area => {
        return resolve(country_area)
      })
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
    fs.readFileAsync(path + country + `/${country}_adm0.csv`, 'utf8')
    .then(content => {
      csv()
      .fromString(content)
      .on('json', jsonData => {
        key = jsonData.ISO.toLowerCase()
        area = parseInt(jsonData.SQKM)
      })
      .on('done', () => {
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
let getImportedCases = (country, population, curr_cases, traffic) => {
  let new_cases = 0, cumm_cases = 0
  Object.keys(traffic).forEach(orig => {
    if (orig in curr_cases && orig in population && orig !== country) {
      let new_cases_in_orig = curr_cases[orig].new_cases_this_week
      let total_new_cases = new_cases_in_orig.autochthonous_cases_confirmed + new_cases_in_orig.imported_cases;

      let cumm_cases_in_orig = curr_cases[orig].cumulative;
      let total_cumm_cases = cumm_cases_in_orig.autochthonous_cases_confirmed + cumm_cases_in_orig.imported_cases;

      let population_of_j = population[orig].sum;
      let travellers_count = traffic[orig];

      new_cases += (total_new_cases / population_of_j) * travellers_count;
      cumm_cases += (total_cumm_cases / population_of_j) * travellers_count;
    }
  })

  return { new_cases, cumm_cases }
}

/**
 * calculates risk of disease using model zero specified in the document
 * @return {Object} risk using model zero for each country
 */

const calculateRiskByModel0 = (population, cases, traffic, countriesList) => {

  let return_val = {};
  Object.keys(cases).forEach(case_date => {
    if (case_date in traffic) {
      let curr_cases = cases[case_date];
      let travellers = traffic[case_date];
      let zika_risk = {};
      countriesList.forEach(country => {
        zika_risk[country] = {}
        zika_risk[country].model_0 = {}

        if (country in travellers) {
        importedCases = getImportedCases(country, population, curr_cases, travellers[country])
        zika_risk[country].model_0.score_new = importedCases.new_cases
        zika_risk[country].model_0.score_cummulative = importedCases.cumm_cases
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
 * @return {Object} risk using first model for each country
 */
let calculateRiskByModel1 = (model_0, mosquito) => {
  Object.keys(model_0).forEach(case_date => {
    Object.keys(model_0[case_date]).forEach(country => {
      model_0[case_date][country].model_1 = {}
      let model_0_for_country = model_0[case_date][country].model_0
      if (mosquito.aegypti[country] === undefined || model_0_for_country.score_new === 'NA') {
        model_0[case_date][country].model_1.score_new = 'NA'
        model_0[case_date][country].model_1.score_cummulative = 'NA'
      } else {
        model_0[case_date][country].model_1.score_new = model_0_for_country.score_new * mosquito.aegypti[country][0].sum
        model_0[case_date][country].model_1.score_cummulative = model_0_for_country.score_cummulative * mosquito.aegypti[country][0].sum
      }
    })
  })
  return model_0
}


/**
 * calculates risk of disease using second model specified in the document
 * @return {Object} risk using second model for each country
 */
let calculateRiskByModel2 = (model_1, population) => {
  Object.keys(model_1).forEach(case_date => {
    Object.keys(model_1[case_date]).forEach(country => {
      model_1[case_date][country].model_2 = {}
      if (population[country] === undefined || model_1[case_date][country].model_1.score_new === 'NA') {
        // model_1[case_date][country].model_2.score_new = 0
        // model_1[case_date][country].model_2.score_cummulative = 0
        model_1[case_date][country].model_2.score_new = 'NA'
        model_1[case_date][country].model_2.score_cummulative = 'NA'
      } else {
        model_1[case_date][country].model_2.score_new  = model_1[case_date][country].model_1.score_new / population[country].sum
        model_1[case_date][country].model_2.score_cummulative = model_1[case_date][country].model_1.score_cummulative / population[country].sum
      }
    })
  })
  return model_1;
}


/**
 * calculates risk of disease using third model specified in the document
 * @return {Object} risk using third model for each country
 */
let calculateRiskByModel3 = (model_1, population) => {
  Object.keys(model_1).forEach(case_date => {
    Object.keys(model_1[case_date]).forEach(country => {
      model_1[case_date][country].model_3 = {}
      if (population[country] === undefined ||
          model_1[case_date][country].model_1.score_new === 'NA'
        ) {
        // model_1[case_date][country].model_3.score_new = 0
        // model_1[case_date][country].model_3.score_cummulative = 0
        model_1[case_date][country].model_3.score_new = 'NA'
        model_1[case_date][country].model_3.score_cummulative = 'NA'
      } else {
        if (!(isNaN(population[country].density))) {
          model_1[case_date][country].model_3.score_new  = model_1[case_date][country].model_1.score_new * population[country].density;
          model_1[case_date][country].model_3.score_cummulative = model_1[case_date][country].model_1.score_cummulative * population[country].density;
        } else {
          model_1[case_date][country].model_3.score_new = 'NA'
          model_1[case_date][country].model_3.score_cummulative = 'NA'
        }
      }
    })
  })
  return model_1;
}

/**
 * calculates risk of disease using forth model specified in the document
 * @return {Object} risk using third model for each country
 */
let calculateRiskByModel4 = (model_1, mosquito, cases) => {
  Object.keys(model_1).forEach(case_date => {
    Object.keys(model_1[case_date]).forEach(country => {
      model_1[case_date][country].model_4 = {}
      if (model_1[case_date][country].model_1.score_new === 'NA' ||
        cases[case_date][country] === undefined ||
        mosquito.aegypti[country] === undefined) {
        model_1[case_date][country].model_4.score_new = 'NA'
        model_1[case_date][country].model_4.score_cummulative = 'NA'
      } else {
        let new_cases = cases[case_date][country].new_cases_this_week
        let cumm_cases = cases[case_date][country].cumulative

        let total_new_cases = new_cases.autochthonous_cases_confirmed + new_cases.imported_cases
        let total_cumm_cases = cumm_cases.autochthonous_cases_confirmed + cumm_cases.imported_cases

        model_1[case_date][country].model_4.score_new = model_1[case_date][country].model_1.score_new + mosquito.aegypti[country][0].sum * total_new_cases
        model_1[case_date][country].model_4.score_cummulative = model_1[case_date][country].model_1.score_cummulative + mosquito.aegypti[country][0].sum * total_cumm_cases
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
