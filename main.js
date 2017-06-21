var main = require('./calculate_risk');
const getConfig = require('./lib/config_helper').getConfig;
const fs = require('fs');
var ArgumentParser = require('argparse').ArgumentParser;

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

main.getRisk(disease)
.then((risk) => {
  Object.keys(risk).forEach(date => {
    console.log(`writting ${date}.json`);
    fs.writeFileSync(`${getConfig('output_path')}/${disease}/${date}.json`, JSON.stringify(risk[date]));
  })
});
