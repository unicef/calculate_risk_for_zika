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
      let model_1 = calculateRiskByModel1(population, mosquito, cases, traffic, countriesList);
      let model_2 = calculateRiskByModel2(model_1, population);
      let model_3 = calculateRiskByModel3(model_1, population);

      return resolve(model_3);
    })
  });
}


/**
 * Function to fetch population and fill in population object
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getPopulationByKey = (path) => {
  return new Promise((resolve, reject) => {
    population_aggregator.getPopulationByKey('population', path)
    .then(content => {
      return resolve(content);
    })
    .catch(error => {
      console.log('Error!', error);
    })
  });
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
 * calculates risk of disease using first model specified in the document
 * @return {Object} risk using first model for each country
 */
let calculateRiskByModel1 = (population, mosquito, cases, traffic, countriesList) => {

  let score_json = '';
  let return_val = {};
  Object.keys(cases).forEach(case_date => {
    if (case_date in traffic) {
      let curr_cases = cases[case_date];
      let travellers = traffic[case_date];
      let zika_risk = {};
      countriesList.forEach(country => {
        let score_new_cases = 0;
        let score_cumm_cases = 0;
        zika_risk[country] = {model_1: {}, model_2: {}, model_3: {}}
        if (country in travellers) {
          Object.keys(travellers[country]).forEach(orig => {
            // && orig in mosquito.aegypti
            if (orig in curr_cases && orig in population && orig !== country) {
              let new_cases_in_j = curr_cases[orig].new_cases_this_week;
              let cumm_cases_in_j = curr_cases[orig].cases_cumulative;
              let population_of_j = population[orig][0].sum;
              let travellers_count = travellers[country][orig];
              score_new_cases += (new_cases_in_j / population_of_j) * travellers_count;
              score_cumm_cases += (cumm_cases_in_j / population_of_j) * travellers_count;
            }
          });
          score_new_cases *= mosquito.aegypti[country][0].sum;
          score_cumm_cases *= mosquito.aegypti[country][0].sum;
          Object.assign(zika_risk[country].model_1, {score_new: score_new_cases, score_cummulative: score_cumm_cases});
        } else {
          zika_risk[country].model_1.score_new = 'NA'
          zika_risk[country].model_1.score_cummulative = 'NA'
        }
      });
      score_json = JSON.stringify(zika_risk);
      if (score_json === undefined || score_json === null) {
        console.error(case_date, 'broke');
      } else {
        return_val[case_date] = {};
        Object.assign(return_val[case_date], zika_risk);
      }
    }
  })
  return return_val;
}


/**
 * calculates risk of disease using second model specified in the document
 * @return {Object} risk using second model for each country
 */
let calculateRiskByModel2 = (model_1, population) => {
  Object.keys(model_1).forEach(case_date => {
    Object.keys(model_1[case_date]).forEach(country => {
      if (population[country] === undefined || model_1[case_date][country].model_1.score_new === 'NA') {
        // model_1[case_date][country].model_2.score_new = 0
        // model_1[case_date][country].model_2.score_cummulative = 0
        model_1[case_date][country].model_2.score_new = 'NA'
        model_1[case_date][country].model_2.score_cummulative = 'NA'
      } else {
        model_1[case_date][country].model_2.score_new  = model_1[case_date][country].model_1.score_new / population[country][0].sum
        model_1[case_date][country].model_2.score_cummulative = model_1[case_date][country].model_1.score_cummulative / population[country][0].sum
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
      if (population[country] === undefined ||
          model_1[case_date][country].model_1.score_new === 'NA'
        ) {
        // model_1[case_date][country].model_3.score_new = 0
        // model_1[case_date][country].model_3.score_cummulative = 0
        model_1[case_date][country].model_3.score_new = 'NA'
        model_1[case_date][country].model_3.score_cummulative = 'NA'
      } else {
        if (!(isNaN(population[country][0].density))) {
          model_1[case_date][country].model_3.score_new  = model_1[case_date][country].model_1.score_new * population[country][0].density;
          model_1[case_date][country].model_3.score_cummulative = model_1[case_date][country].model_1.score_cummulative * population[country][0].density;
        }
      }
    })
  })
  return model_1;
}

module.exports = {
  getPopulationByKey,
  getMosquito,
  getTravelData,
  getCases,
  getRisk
}
