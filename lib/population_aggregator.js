var config = require('../config');
var async = require('async');
var bluebird = require('bluebird');
var readdirAsync = bluebird.promisify(require('fs').readdir);

/**
 * Return list of countries with aggregated population data
 * @param{String} request - request object
 * @param{String} res - response object
 * @return{Promise} Fulfilled when records are returned
 */
exports.getPopulationByKey = (kind) => {
  return new Promise((resolve, reject) => {
    async.waterfall([
      function(callback) {
        // gadm2-8, santiblanko
        getDirs(config[kind].path)
        .then(directories => {
          callback(null, directories, kind);
        });
      },
      // Iterate through each shapefile source
      // and keep a running hash of country to array of aggregations per source
      function(dirs_shapefiles, kind, callback) {
        bluebird.reduce(dirs_shapefiles, (h, dir) => {
          return aggregateShapefiles(h, dir, kind)
          .then(updated_hash => {
            h = updated_hash;
            return h;
          })
        }, {})
        .then(hash => {
          callback(hash);
        })
      },
    ], function(population) {
      return resolve(population);
    });
  })
}
function aggregateShapefiles(h, dir, kind) {
  return new Promise((resolve, reject) => {
    getDirs(config[kind].path + dir)
    .then(files => {
      files.forEach(e => {
        var record = fileToRecord(e);
        if(h[record.country]) {
          h[record.country].push(record);
        } else {
          h[record.country] = [record];
        }
      });
      return resolve(h);
    });
  });
}

/**
 * Return object for raster that contains metadata gleaned from the raster file name
 * @param{Object} raster_blob_obj - raster blob object from storage
 * @return{Object} Raster metadata
 */
function fileToRecord(file_obj) {
  // tha_3_gadm2-8^THA_ppp_v2b_2015_UNadj^worldpop^74943039^198478.json
  var record = file_obj.split(/\^/);
  // tha_3_gadm2-8
  var ary = record[0].split('_');
  var shapefile = ary.pop();
  var admin_level = ary.pop();
  var country = ary.pop();
  // worldpop
  var data_source = record[2];
  var pop_sum = parseFloat(record[3]);
  var sq_km = parseInt(record[4].replace(/.json/, ''));
  return {
    // kind: file_obj.kind,
    country: country,
    data_source: data_source,
    // 3 letter iso code
    // gadm2-8
    shapefile_set: shapefile,
    // 0, 1, 2, 3, 4, 5...
    admin_level: admin_level,
    sum: pop_sum,
    sq_km: sq_km,
    density: (pop_sum/sq_km),
    // popmap15adj.json
    raster: record[1].replace(/.json$/, '')
  };
  return pop_obj;
}

function getDirs(path) {
  return new Promise(function(resolve, reject) {
    readdirAsync(path)
    .then( fileList => {
      return resolve(fileList);
    });
  });
}
