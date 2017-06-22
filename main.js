var main = require('./calculate_risk');
const getConfig = require('./lib/config_helper').getConfig;
const fs = require('fs');
var ArgumentParser = require('argparse').ArgumentParser;
var bluebird = require('bluebird')

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

// for each week calculate risk and write it to file at output_path/disease/date.json
bluebird.each(weeks, date => {
  main.getRisk(date, disease)
  .then((risk) => {
    console.log(`writting ${date}.json`);
    fs.writeFileSync(`${getConfig('output_path')}/${disease}/${date}.json`, JSON.stringify(risk[date]));
  });
}, {concurency: 1})
