// let config = require('./config');
const getConfig = require('./lib/config_helper').getConfig;
const bluebird = require('bluebird');
const async = require('async');
const population_aggregator = require('./lib/population_aggregator');
const fs = require('fs');
const pro_fs = bluebird.promisifyAll(fs);
const jsonfile = bluebird.promisify(require('jsonfile').readFile);
const csv = require('csvtojson');
const country_codes = require('./country_codes');

// objects to store data
let population = {};
let mosquito = {aegypti:{}, albopictus:{}};
let traffic = {};
let cases = {};

/**
 * This function will fetch all the data required to calculate risk of an epidemic
 * and will calculate risk using callback function. If callback is not specified it uses calculateRisk
 * @param  {String}   disease  name of disease
 * @param  {Object}   in_path  input paths for all data elements
 * @param  {Function} callback callback function to calculate risk
 */
let getRisk = (disease, in_path, callback) => {
  callback = callback || calculateRisk
  async.waterfall([
    // get population
    (callback) => {
      let path = in_path.population || getConfig('population', 'path')
      // if (in_path !== undefined) {
      //   path = in_path.population;
      // }
      getPopulationByKey(path)
      .then(() => {
        callback();
      })
      .catch(error => {
        console.log('Error!!', error);
      });
    },
    // get mosquito prevelence
    (callback) => {
      // let path = undefined;
      // if (in_path !== undefined) {
      //   path = in_path.aegypti;
      // }
      let path = in_path.aegypti || getConfig('aegypti', 'path')
      getMosquito(path)
      .then(() => {
        callback();
      });
    },
    // get cases of disease specified
    (callback) => {
      let path = in_path.cases.zika.path || getConfig('cases', 'zika').path
      // let path = undefined;
      // if (in_path !== undefined) {
      //   path = in_path.cases.zika.path;
      // }
      getCases(disease, path)
      .then(() => {
        callback()
      });
    },
    // get travel data
    (callback) => {
      // let path = undefined;
      // if (in_path !== undefined) {
      //   path = in_path.travel;
      // }
      let path = in_path.travel || getConfig('travel', 'path')
      getTravelData(path)
      .then(() => {
        callback(null, disease)
      });
    }
  ], callback
)}


/**
 * This function will calculate risk based on 3 models specified here:
 * https://docs.google.com/document/d/1HXza92vgSsFwhtXG8r7pSphXda_yPzdtY0OOGfdMMpk/edit#heading=h.4xf8sw2x1upl
 * @param  {String} error   error message
 * @param  {String} disease name of disease
 */
let calculateRisk = (error, disease) => {
  console.log('writing result!');
  let output_path = getConfig('output_path')
  let model_1 = calculateRiskByModel1();
  let model_2 = calculateRiskByModel2(model_1);
  let model_3 = calculateRiskByModel3(model_1);

  Object.keys(model_3).forEach(date => {
    fs.writeFileSync(`${output_path}/${disease}/${date}.json`, JSON.stringify(model_3[date]));
  })
  console.log("Wrote!!");
}

/**
 * Function to fetch population
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getPopulationByKey = (path) => {
  return new Promise((resolve, reject) => {
    population_aggregator.getPopulationByKey('population', path)
    .then(content => {
      Object.assign(population, content);
      return resolve();
    })
    .catch(error => {
      console.log('Error!', error);
    })
  });
}

/**
 * Function to fetch mosquito prevelence
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getMosquito = (path) => {
  return new Promise((resolve, reject) => {
    population_aggregator.getPopulationByKey('aegypti', path)
    .then(content => {
      Object.assign(mosquito.aegypti, content);
      return resolve();
    })
    .catch(error => {
      console.log('Error!', error);
    })

    // population_aggregator.getPopulationByKey('albopictus')
    // .then(content => {
    //   Object.assign(mosquito.albopictus, content);
    // })
    // .catch(error => {
    //   console.log('Error!', error);
    // })
  });
}

/**
 * Function to fetch travel data
 * @param  {String} path path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getTravelData = (path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('travel', 'path')
    }
    // var path = path || getConfig('travel', 'path')
    pro_fs.readdirAsync(path)
    .then(fileList => {
      let files = fileList.entries.files;
      bluebird.each(fileList, file => {
        let fileName = file;
        let date = fileName.split('.')[0];
        traffic[date] = {};
        return aggregateTravels(fileName, date, path);
      }, {concurency:1})
      .then(resolve);
    })
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
    // var path = path || getConfig('travel', 'path')
    pro_fs.readFileAsync(path + fileName, 'utf8')
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
      .on('done', resolve);
    });
  });
}

/**
 * Function to fetch cases
 * @param  {String} disease name of the disease
 * @param  {String} path     path of input folder
 * @return {Promise} Fulfilled when records are returned
 */
let getCases = (disease, path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig('cases', disease).path
    }
    // var path = path || getConfig('cases', disease).path
    pro_fs.readdirAsync(path)
    .then(files => {
      bluebird.each(files, file => {
         return readCaseFile(disease, file, path);
      }, {concurency : 1})
      .then(resolve)
    })
    .catch(error => {
      console.log('Error!', error);
      reject(error);
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
    cases[date] = {};
    if (path === undefined) {
      path = getConfig('cases', disease).path
    }
    // var path = path || getConfig('cases', disease).path
    jsonfile(path + file)
    .then(content => {
      Object.assign(cases[date], content.countries);
      return resolve();
    })
    .catch(error => {
      return reject(error);
    })
  });
}

/**
 * calculates risk of disease using first model specified here:
https://docs.google.com/document/d/1HXza92vgSsFwhtXG8r7pSphXda_yPzdtY0OOGfdMMpk/edit#heading=h.5yyfyohzaii1
 * @return {Object} risk using first model for each country
 */
let calculateRiskByModel1 = () => {
  let score_json = '';
  let return_val = {};
  Object.keys(cases).forEach(case_date => {
    if (case_date in traffic) {
      let curr_cases = cases[case_date];
      let travellers = traffic[case_date];
      let zika_risk = {};
      Object.keys(travellers).forEach(country => {
        let score_new_cases = 0;
        let score_cumm_cases = 0;
        Object.keys(travellers[country]).forEach(orig => {
          if (orig in curr_cases && orig in population && orig in mosquito.aegypti && orig !== country) {
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
        zika_risk[country] = {model_1: {}, model_2: {}, model_3: {}}
        Object.assign(zika_risk[country].model_1, {score_new: score_new_cases, score_cummulative: score_cumm_cases});
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
 * calculates risk of disease using second model specified here:
https://docs.google.com/document/d/1HXza92vgSsFwhtXG8r7pSphXda_yPzdtY0OOGfdMMpk/edit#heading=h.5yyfyohzaii1
 * @return {Object} risk using second model for each country
 */
let calculateRiskByModel2 = (model_1) => {
  Object.keys(model_1).forEach(case_date => {
    Object.keys(model_1[case_date]).forEach(country => {
      if (population[country] === undefined) {
        console.log(country, 'not found');
      } else {
        model_1[case_date][country].model_2.score_new  = model_1[case_date][country].model_1.score_new / population[country][0].sum
        model_1[case_date][country].model_2.score_cummulative = model_1[case_date][country].model_1.score_cummulative / population[country][0].sum
      }
    })
  })
  return model_1;
}


/**
 * calculates risk of disease using third model specified here:
https://docs.google.com/document/d/1HXza92vgSsFwhtXG8r7pSphXda_yPzdtY0OOGfdMMpk/edit#heading=h.5yyfyohzaii1
 * @return {Object} risk using third model for each country
 */
let calculateRiskByModel3 = (model_1) => {
  Object.keys(model_1).forEach(case_date => {
    Object.keys(model_1[case_date]).forEach(country => {
      if (population[country] === undefined) {
        console.log(country, 'not found');
      } else {
        model_1[case_date][country].model_3.score_new  = model_1[case_date][country].model_1.score_new * population[country][0].sum * population[country][0].sq_km;
        model_1[case_date][country].model_3.score_cummulative = model_1[case_date][country].model_1.score_cummulative * population[country][0].sum * population[country][0].sq_km;
      }
    })
  })
  return model_1;
}

module.exports = {
  mosquito,
  population,
  cases,
  traffic,
  getPopulationByKey,
  getMosquito,
  getTravelData,
  getCases,
  getRisk,
  calculateRiskByModel1,
  calculateRiskByModel2,
  calculateRiskByModel3
}
