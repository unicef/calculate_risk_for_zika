var config = require('../config');
var csv = require('csvtojson');
var jsonfile = require('jsonfile');
var output = 'output.txt';
/**
 * Gets list of country population aggregation blobs
 * Just in case we want to only process files that we don't already have
 * @param{String} container_name - Name of blob container
 * @return{Promise} Fulfilled list of blobs
 */
exports.get_file_list = (fileSrv, dir, path) => {
  return new Promise(function(resolve, reject) {
    fileSrv.listFilesAndDirectoriesSegmented(dir, path, null, function(err, result, response) {
      if (err) {
        return reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Reads a file at specified path (dir/path/file_name.format) and returns a Json
 * Object with file contents
 * @param  {FileServer} fileSrv   Reference to File server, where file is present
 * @param  {String} dir       Base directory fro the file
 * @param  {String} path      Path of the folder holding the file
 * @param  {String} file_name File name
 * @param  {String} format    File format
 * @return {Object}           Json object created from the file content
 */
exports.get_file = (fileSrv, dir, path, file_name, format) => {
  return new Promise((resolve, reject) => {
    fileSrv.getFileToText(dir, path, file_name, function(err, fileContent, file) {
      if (!err) {
        if (format === '.json') {
          resolve(JSON.parse(fileContent));
        } else {
          obj = {};
          obj.date = file_name;
          obj.trips = {};
          csv()
          .fromString(fileContent)
          .on('json',(row_obj)=>{ // this func will be called 3 times
            obj.trips[row_obj.orig + row_obj.dest] = row_obj.cnt;
          })
          .on('done',()=>{
            resolve(obj);
          	//parsing finished
          })
        }
      }
    });
  })
}
