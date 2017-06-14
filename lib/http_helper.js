var http = require('http');
var jsonfile = require('jsonfile');
var config = require('../config');
var api_addr = config.api_addr;


exports.get_data_from_api = function (kind, options, callback) {
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
      callback(null, result, item);
    });
    response.on('error', (error) => {
      callback(error);
    });
  });
};
