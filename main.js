var main = require('./calculate_risk');
const getConfig = require('./lib/config_helper').getConfig;
const fs = require('fs');
var ArgumentParser = require('argparse').ArgumentParser;
var bluebird = require('bluebird')
const async = require('async');
var csvtojson = require('csvtojson')
var readFile = bluebird.promisify(fs.readFile)
var readDir = bluebird.promisify(fs.readdirAsync)
const jsonfile = bluebird.promisify(require('jsonfile').readFile);

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

/**
 * Get weeks for which we have traffic as well as cases
 * @return {List} List of start date of weeks that are common in cases and traffic
 */
const getWeeks = () => {
  let cases_path = getConfig('cases', disease).path
  let travel_path = getConfig('travel', 'path')

  cases_files = fs.readdirSync(cases_path).reduce((obj, file) => {
    obj.push(file.split('.')[0])
    return obj
  }, [])

  travel_files = fs.readdirSync(travel_path).filter((file) => {
    return cases_files.indexOf(file.split('.')[0]) > 0;
  })
  .reduce((obj, file) => {
    obj.push(file.split('.')[0])
    return obj
  }, [])

  return travel_files
}

// get weeks common to cases and traffic
let weeks = getWeeks()

// objects to store population and mosquito prevelence as it is static and won't change everyweek
let population = {}
let mosquito = {}

async.waterfall([
  // get population and fill in population object
  // (callback) => {
  //   main.getPopulationByKey(getConfig('population', 'path'))
  //   .then(content => {
  //     Object.assign(population, content)
  //     callback(null)
  //   })
  // },
  (callback) => {
    let tempPopulation = {}
    readFile('./POP.csv', 'utf8')
    .then(content => {
      csvtojson({noheader:true})
      .fromString(content)
      .on('json',(json) => {
        let country = json.field1.toLowerCase()
        if (!(country in population)) {
          let pop = parseInt(json.field5.replace(/,/g, '')) * 1000
          tempPopulation[country] = [{ sum: pop }]
        }
      })
      .on('done',()=>{
        Object.assign(population, tempPopulation)
        callback(null)
      })
    })
  },
  (callback) => {
    readDir(getConfig('shape_files'))
    .then(countries => {
      bluebird.each(countries, country => {
        readFile(getConfig('shape_files') + country + '/' + `${country}_adm0.csv`, 'utf8')
        .then(content => {
          csvtojson()
          .fromString(content)
          .on('json',(json) => {
            let key = json.ISO.toLowerCase()
            if (key in population) {
              let area = parseInt(json.SQKM)
              population[key][0].sq_km = area
            }
          })
          .on('done',()=>{
            callback(null)
          })
        })
      })
    })
  },
  // get mosquito prevelence and fill in mosquito object
  (callback) => {
    console.log(population);
    main.getMosquito(getConfig('aegypti', 'path'))
    .then(content => {
      Object.assign(mosquito, content)
      callback(null)
    })
  },
  // calculate risk for every week
  (callback) => {
    bluebird.each(weeks, date => {
      main.getRisk(date, disease, population, mosquito)
      .then((risk) => {
        // write it in a file at output_path/disease/date.json
        console.log(`writting ${date}.json`);
        fs.writeFileSync(`${getConfig('output_path')}/${disease}-worldbank/${date}.json`, JSON.stringify(risk[date]));
      });
    }, {concurency: 1})
  }
])
