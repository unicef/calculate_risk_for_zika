var main = require('./calculate_risk');

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

main.getRisk(disease);
