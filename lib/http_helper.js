var http = require('http');
var jsonfile = require('jsonfile');
var config = require('../config');
var api_addr = config.api_addr;

/**
 * Helper function to fetch data using an URL
 * @param  {String} kind    Represents what we want to fetch
 * @param  {Object} options Other options that might be required to fetch the data
 * @return {String}         String representation of the data
 */
exports.get_data_from_api = function (kind, options) {
  return new Promise((resolve, reject) => {
    var request_obj = {
      host: api_addr,
      path: '/api/' + kind,
      port: 8000
    };

    http.get(request_obj, (response) => {
      response.setEncoding('utf8');
      var result = '';
      response.on('data', (data) => {
        result += data;
      });
      response.on('end', ()=> {
        return resolve(result);
      });
      response.on('error', (error) => {
        return reject(error);
      });
    });
  });
};
