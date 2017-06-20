// var config = require('../config');
const getConfig = require('./config_helper').getConfig;
const async = require('async');
const bluebird = require('bluebird');
const readdirAsync = bluebird.promisify(require('fs').readdir);

/**
 * Return list of countries with aggregated population data
 * @param{String} request - request object
 * @param{String} res - response object
 * @return{Promise} Fulfilled when records are returned
 */
exports.getPopulationByKey = (kind, path) => {
  return new Promise((resolve, reject) => {
    async.waterfall([
      function(callback) {
        // gadm2-8, santiblanko
        if (path === undefined) {
          path = getConfig(kind, 'path');
        }
        getDirs(path)
        .then(directories => {
          callback(null, directories, kind, path);
        });
      },
      // Iterate through each shapefile source
      // and keep a running hash of country to array of aggregations per source
      function(dirs_shapefiles, kind, path, callback) {
        bluebird.reduce(dirs_shapefiles, (h, dir) => {
          return aggregateShapefiles(h, dir, kind, path)
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
const aggregateShapefiles = (h, dir, kind, path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig(kind, 'path');
    }
    getDirs(path + dir)
    .then(files => {
      files.forEach(e => {
        let record = fileToRecord(e);
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
const fileToRecord = (file_obj) => {
  // tha_3_gadm2-8^THA_ppp_v2b_2015_UNadj^worldpop^74943039^198478.json
  let record = file_obj.split(/\^/);
  // tha_3_gadm2-8
  let ary = record[0].split('_');
  let shapefile = ary.pop();
  let admin_level = ary.pop();
  let country = ary.pop();
  // worldpop
  let data_source = record[2];
  let pop_sum = parseFloat(record[3]);
  let sq_km = parseInt(record[4].replace(/.json/, ''));

  // let [ ary, data_source, pop_sum, sq_km ] = record
  // let [ shapefile, admin_level, country ] = ary.split('_')


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

const getDirs = (path) => {
  return new Promise((resolve, reject) => {
    readdirAsync(path)
    .then( fileList => {
      return resolve(fileList);
    });
  });
}
