const main = require('./calculate_risk');
const getConfig = require('./lib/config_helper').getConfig;
const fs = require('fs');
const ArgumentParser = require('argparse').ArgumentParser;
const bluebird = require('bluebird')
const async = require('async');

const country_codes = require('./country_codes')

const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'calculate risk of a disease'
});


parser.addArgument(
  ['-d', '--disease'],
  { help: 'Name of disease' }
);


const args = parser.parseArgs();
const disease = args.disease;

/**
 * Get weeks for which we have traffic as well as cases
 * @return {List} List of start date of weeks that are common in cases and traffic
 */
const getWeeks = () => {
  const cases_path = getConfig('cases', disease).path
  const travel_path = getConfig('travel', 'path')

  const cases_files = fs.readdirSync(cases_path).reduce((obj, file) => {
    obj.push(file.split('.')[0])
    return obj
  }, [])

  const travel_files = fs.readdirSync(travel_path).filter((file) => {
    return cases_files.indexOf(file.split('.')[0]) > 0;
  })
    .reduce((obj, file) => {
      obj.push(file.split('.')[0])
      return obj
    }, [])

  return travel_files
}

// get weeks common to cases and traffic
const weeks = getWeeks()

// objects to store population and mosquito prevelence as it is static and won't change everyweek
const population = {}
const mosquito = {}
let countriesList = []

async.waterfall([
  // get population and fill in population object
  (callback) => {
    countriesList = Object.keys(country_codes).reduce((list, code) => {
      list.push(country_codes[code].toLowerCase())
      return list
    }, [])
    callback()
  },
  // get population from world-bank, currently it's fetched from the file POP.csv
  (callback) => {
    main.getPopulation()
      .then((content) => {
        Object.assign(population, content)
        callback(null)
      })
  },
  // get area of each country. Area is fetched from directory ../shapefiles. In this we have separate directory for each country which holds csv and shp files for all admin levels.
  // For area we use admin level 0 files.
  (callback) => {
    main.getArea()
      .then((content) => {
        Object.keys(content).forEach((country) => {
          if (country in population) {
            population[country].sq_km = content[country]
            population[country].density =
            population[country].sum / population[country].sq_km
          }
        })
        callback(null)
      })
  },
  // get mosquito prevelence and fill in mosquito object
  (callback) => {
    main.getMosquito(getConfig('aegypti', 'path'))
      .then((content) => {
        Object.assign(mosquito, content)
        callback(null)
      })
  },
  // calculate risk for every week
  (callback) => {
    bluebird.each(weeks, (date) => {
      main.getRisk(date, disease, population, mosquito, countriesList)
        .then((risk) => {
        // write it in a file at output_path/disease/date.json
          console.log(`writting ${date}.json`);
          const printString = `${getConfig('output_path')}/${disease}-worldbank/${date}.json`
          fs.writeFileSync(printString, JSON.stringify(risk[date]));
        });
    }, { concurency: 1 })
      .then(() => { callback(null) })
  }
], (error) => {
  if (error) {
    console.log('Opps!', error);
  }
  console.log('Done calculating risk!');
})
