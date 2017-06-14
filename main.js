var azure_helper = require("./lib/azure_helper");
var azure_storage = require('azure-storage');
var config = require('./config');
var ArgumentParser = require('argparse').ArgumentParser;
var bluebird = require('bluebird');
var http_helper = require('./lib/http_helper');
var storage_account = config.azure.storage;
var azure_key = config.azure.key1;
var fileSvc = azure_storage.createFileService(storage_account, azure_key);

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
var mosquito = {};
var traffic = {};
var cases = {};

getTravelData();

function save_data(error, data, item) {
  if (error) {
    console.log("Error!!", error);
    process.exit();
  }

  if (item === 'population') {
    Object.assign(population, JSON.parse(data).data);
  } else if (item === 'mosquito') {
    Object.assign(mosquito, JSON.parse(data));
  } else if (item == 'cases') {
    Object.assign(cases, JSON.parse(data))
  }
}


function getTravelData() {
  azure_helper.get_file_list(fileSvc, config.travel.dir, config.travel.path)
  .then(files => {
    console.log(files);
    files.sort();
    files.reverse();
    var file = files[0];
    azure_helper.get_file(fileSvc, config.travel.dir, config.travel.path, file, config.travel.format)
    .then(content => {
      console.log(content); process.exit();
    })
    .catch(error => {
      console.log('Error!!', error);
    });
  })
  .catch(error => {
    console.log('Error!!', error);
  });
}
