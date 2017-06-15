var azure_helper = require("./lib/azure_helper");
var azure_storage = require('azure-storage');
var config = require('./config');
var ArgumentParser = require('argparse').ArgumentParser;
var bluebird = require('bluebird');
var http_helper = require('./lib/http_helper');
var async = require('async');
const fs = require('fs');
var storage_account = config.azure.storage;
var azure_key = config.azure.key1;
var fileSvc = azure_storage.createFileService(storage_account, azure_key);
var country_codes = require('./country_codes');
var output_path = '../mnt/risk/';

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
    getPopulation()
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
  Object.keys(cases).forEach(case_date => {
    if (case_date in traffic) {
      var curr_cases = cases[case_date];
      var travellers = traffic[case_date];
      var zika_risk = {};
      Object.keys(travellers).forEach(country => {
        var score_new_cases = 0;
        var score_cumm_cases = 0;
        Object.keys(travellers[country]).forEach(orig => {
          if (orig in curr_cases && orig in population && orig in mosquito.aegypti) {
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
        zika_risk[country] = {score_new_cases: score_new_cases, score_cumm_cases: score_cumm_cases};
      });
      var score_json = JSON.stringify(zika_risk);
      if (score_json === undefined || score_json === null) {
        console.log(case_date, 'broke');
      } else {
        fs.writeFileSync(`${output_path}/${disease}/${case_date}.json`, score_json);
        console.log("Wrote!!");
      }
    }
  });
});

console.log("End!!");


function getPopulation() {
  return new Promise((resolve, reject) => {
    http_helper.get_data_from_api('population', null)
    .then(content => {
      Object.assign(population, JSON.parse(content).data);
      return resolve();
    })
    .catch(error => {
      console.log('Error which fetching population!', error);
    });
    return resolve();
  });
}

function getMosquito() {
  return new Promise((resolve, reject) => {
    http_helper.get_data_from_api('mosquito/aegypti', null)
    .then(content => {
      Object.assign(mosquito.aegypti, JSON.parse(content).data);
    })
    .catch(error => {
      console.log('Error which fetching mosquito aegypti!', error);
    });

    http_helper.get_data_from_api('mosquito/albopictus', null)
    .then(content => {
      Object.assign(mosquito.albopictus, JSON.parse(content).data);
    })
    .catch(error => {
      console.log('Error which fetching mosquito albopictus!', error);
    });
    return resolve();
  });
}


function getTravelData() {
  return new Promise(function(resolve, reject) {
    // get file list
    azure_helper.get_file_list(fileSvc, config.travel.dir, config.travel.path)
    .then(fileList => {
      var files = fileList.entries.files;
      var n = files.length;
      bluebird.each(files, file => {
        var fileName = file.name;
        var date = fileName.split('.')[0];
        traffic[date] = {};
        return aggregate_travel(fileName, date);
      }, {concurency:1})
      .then(resolve);
    })
    .catch(error => {
      console.log('Error in fetching travel data', error);
      return reject(error);
    });
  });
}

function aggregate_travel(fileName, date) {
  return new Promise(function(resolve, reject) {
    azure_helper.get_file(fileSvc, config.travel.dir, config.travel.path, fileName, config.travel.format)
    .then(content => {
      Object.keys(content.trips).forEach(trip => {
        var orig = country_codes[trip.slice(0, 2)];
        var dest = country_codes[trip.slice(-2)];
        if (orig !== undefined && dest !== undefined) {
          dest = dest.toLowerCase();
          orig = orig.toLowerCase();
          if (dest in traffic[date]) {
            traffic[date][dest][orig] = content.trips[trip];
          } else {
            traffic[date][dest] = {};
            traffic[date][dest][orig] = content.trips[trip];
          }
        }
    });
    return resolve();
  });
});
}

function getCases() {
  return new Promise((resolve, reject) => {
    http_helper.get_data_from_api(config.cases[disease].url, null)
    .then(content => {
      Object.assign(cases, JSON.parse(content).cases);
      return resolve();
    })
    .catch(error => {
      console.log('Error which feching cases', error);
      return reject(error);
    });
  });
}
