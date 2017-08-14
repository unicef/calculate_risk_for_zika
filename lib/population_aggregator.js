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
  // var lintError = "fksmnofisng"
  return new Promise((resolve, reject) => {
    async.waterfall([
      function (callback) {
        // gadm2-8, santiblanko
        if (path === undefined) {
          path = getConfig(kind, 'path');
        }
        getDirs(path)
          .then((directories) => {
            callback(null, directories, kind, path);
          })
          .catch(reject)
      },
      // Iterate through each shapefile source
      // and keep a running hash of country to array of aggregations per source
      function (dirs_shapefiles, data_kind, data_path, callback) {
        bluebird.reduce(dirs_shapefiles, (h, dir) => {
          return aggregateShapefiles(h, dir, kind, path)
            .then((updated_hash) => {
              h = updated_hash;
              return h;
            });
        }, {})
          .then((hash) => {
            callback(hash);
          })
          .catch(reject)
      }
    ], (population) => {
      return resolve(population);
    });
  })
};


/**
 * Aggregates shape files
 * @param  {obejct} h    object to store aggregated data
 * @param  {string} dir  path for directory
 * @param  {string} kind kind of data (population or mosquito)
 * @param  {string} path file path of data
 * @return {Promise} Fulfilled when records are returned
 */
const aggregateShapefiles = (h, dir, kind, path) => {
  return new Promise((resolve, reject) => {
    if (path === undefined) {
      path = getConfig(kind, 'path');
    }
    getDirs(path + dir)
      .then((files) => {
        files.forEach((e) => {
          const record = fileToRecord(e);
          if (h[record.country]) {
            h[record.country].push(record);
          } else {
            h[record.country] = [record];
          }
        });
        return resolve(h);
      })
      .catch(reject)
  });
};

/**
 * Return object for raster that contains metadata gleaned from the raster file name
 * @param{Object} file_obj - raster blob object from storage
 * @return{Object} Raster metadata
 */
const fileToRecord = (file_obj) => {
  // tha_3_gadm2-8^THA_ppp_v2b_2015_UNadj^worldpop^74943039^198478.json
  const record = file_obj.split(/\^/);
  // tha_3_gadm2-8
  const ary = record[0].split('_');
  const shapefile = ary.pop();
  const admin_level = ary.pop();
  const country = ary.pop();
  // worldpop
  const data_source = record[2];
  const pop_sum = parseFloat(record[3]);
  const sq_km = parseInt(record[4].replace(/.json/, ''));

  // let [ ary, data_source, pop_sum, sq_km ] = record
  // let [ shapefile, admin_level, country ] = ary.split('_')


  return {
    // kind: file_obj.kind,
    country,
    data_source,
    // 3 letter iso code
    // gadm2-8
    shapefile_set: shapefile,
    // 0, 1, 2, 3, 4, 5...
    admin_level,
    sum: pop_sum,
    sq_km,
    density: (pop_sum / sq_km),
    // popmap15adj.json
    raster: record[1].replace(/.json$/, '')
  };
};

/**
 * Returns list of directories in given path
 * @param  {string} path directory path
 * @return{Promise} Fulfilled when list of directories is returned
 */
const getDirs = (path) => {
  return new Promise((resolve, reject) => {
    readdirAsync(path)
      .then((fileList) => {
        return resolve(fileList);
      })
      .catch(reject)
  });
};
