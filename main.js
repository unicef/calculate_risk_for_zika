var config = require('./config');
var ArgumentParser = require('argparse').ArgumentParser;
var bluebird = require('bluebird');
var async = require('async');
var population_aggregator = require('./lib/population_aggregator');
const fs = require('fs');
const pro_fs = bluebird.promisifyAll(fs);
const jsonfile = bluebird.promisify(require('jsonfile').readFile);
var csv = require('csvtojson');
var country_codes = require('./country_codes');

var weeks = [];

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'calculate risk of a disease'
});

parser.addArgument(
  ['-d', '--disease'],
  {help: 'Name of disease'}
);

var args = parser.parseArgs();
var disease = args.disease;

var population = {};
var mosquito = {aegypti:{}, albopictus:{}};
var traffic = {};
var cases = {};

console.log("started!!");
async.waterfall([
  function (callback) {
    getPopulationByKey()
    .then(() => {
      callback();
    })
    .catch(error => {
      console.log('Error!!', error);
    });
  },
  function (callback) {
    getMosquito()
    .then(() => {
      callback();
    });
  },
  function (callback) {
    getCases()
    .then(() => {
      callback()
    });
  },
  function (callback) {
    getTravelData()
    .then(() => {
      callback(null)
    });
  }
], (error) => {
  console.log('done!');
  var model_1 = calculateRiskByModel1();
  fs.writeFileSync(`${config.output_path}/${disease}/model_1.json`, JSON.stringify(model_1));
  var model_2 = calculateRiskByModel2(model_1);
  fs.writeFileSync(`${config.output_path}/${disease}/model_2.json`, JSON.stringify(model_2));
  var model_3 = calculateRiskByModel3(model_1);
  fs.writeFileSync(`${config.output_path}/${disease}/model_3.json`, JSON.stringify(model_3));
  console.log("Wrote!!");
});

function getPopulationByKey() {
  return new Promise(function(resolve, reject) {
    population_aggregator.getPopulationByKey('population')
    .then(content => {
      Object.assign(population, content);
      return resolve();
    })
    .catch(error => {
      console.log('Error!', error);
    })
  });
}


function getMosquito() {
  return new Promise(function(resolve, reject) {
    population_aggregator.getPopulationByKey('aegypti')
    .then(content => {
      Object.assign(mosquito.aegypti, content);
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
    return resolve();
  });
}


function getTravelData() {
  return new Promise(function(resolve, reject) {
    // get file list
    pro_fs.readdirAsync(config.travel.path)
    .then(fileList => {
      var files = fileList.entries.files;
      bluebird.each(fileList, file => {
        var fileName = file;
        var date = fileName.split('.')[0];
        traffic[date] = {};
        return aggregateTravels(fileName, date);
      }, {concurency:1})
      .then(resolve);
    })
    .catch(error => {
      console.log('Error in fetching travel data', error);
      return reject(error);
    });
  });
}


function aggregateTravels(fileName, date) {
  return new Promise(function(resolve, reject) {
    pro_fs.readFileAsync(config.travel.path + fileName, 'utf8')
    .then(content => {
      csv({flatKeys:true})
      .fromString(content)
      .on('json',(trip)=>{
        var orig = country_codes[trip.orig];
        var dest = country_codes[trip.dest];
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


function getCases() {
  return new Promise(function(resolve, reject) {
    pro_fs.readdirAsync(config.cases[disease].fs_dir)
    .then(files => {
      bluebird.each(files, file => {
         return readCaseFile(file);
      }, {concurency : 1})
      .then(resolve)
    })
    .catch(error => {
      console.log('Error!', error);
      reject(error);
    })
  });
}

function readCaseFile(file) {
  return new Promise(function(resolve, reject) {
    var date = file.split('.')[0];
    cases[date] = {};
    jsonfile(config.cases[disease].fs_dir + file)
    .then(content => {
      Object.assign(cases[date], content.countries);
      return resolve();
    })
    .catch(error => {
      return reject(error);
    })
  });
}

function calculateRiskByModel1() {
  var score_json = '';
  var return_val = {};
  Object.keys(cases).forEach(case_date => {
    if (case_date in traffic) {
      var curr_cases = cases[case_date];
      var travellers = traffic[case_date];
      var zika_risk = {};
      Object.keys(travellers).forEach(country => {
        var score_new_cases = 0;
        var score_cumm_cases = 0;
        Object.keys(travellers[country]).forEach(orig => {
          if (orig in curr_cases && orig in population && orig in mosquito.aegypti && orig !== country) {
            var new_cases_in_j = curr_cases[orig].new_cases_this_week;
            var cumm_cases_in_j = curr_cases[orig].cases_cumulative;
            var population_of_j = population[orig][0].sum;
            var travellers_count = travellers[country][orig];
            score_new_cases += (new_cases_in_j / population_of_j) * travellers_count;
            score_cumm_cases += (cumm_cases_in_j / population_of_j) * travellers_count;
          }
        });
        score_new_cases *= mosquito.aegypti[country][0].density;
        score_cumm_cases *= mosquito.aegypti[country][0].density;
        zika_risk[country] = {model_1_score_new: score_new_cases, model_1_score_cummulative: score_cumm_cases};
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

function calculateRiskByModel2(model_1) {
  var score_json = {};
  Object.keys(model_1).forEach(case_date => {
    score_json[case_date] = {};
    Object.keys(model_1[case_date]).forEach(country => {
      if (population[country] === undefined) {
        console.log(country, 'not found');
      } else {
        score_json[case_date][country] = {};
        score_json[case_date][country].model_2_score_new  = model_1[case_date][country].model_1_score_new / population[country][0].sum
        score_json[case_date][country].model_2_score_cummulative = model_1[case_date][country].model_1_score_cummulative / population[country][0].sum
      }
    })
  })
  return score_json;
}

function calculateRiskByModel3(model_1) {
  var score_json = {};
  Object.keys(model_1).forEach(case_date => {
    score_json[case_date] = {};
    Object.keys(model_1[case_date]).forEach(country => {
      if (population[country] === undefined) {
        console.log(country, 'not found');
      } else {
        score_json[case_date][country] = {};
        score_json[case_date][country].model_3_score_new  = model_1[case_date][country].model_1_score_new * population[country][0].sum * population[country][0].sq_km;
        score_json[case_date][country].model_3_score_cummulative = model_1[case_date][country].model_1_score_cummulative * population[country][0].sum * population[country][0].sq_km;
      }
    })
  })
  return score_json;
}
