const config = require('../config')

/**
 * This function will return config value for specified key.property
 * @param  {String} key      key
 * @param  {String} property property
 * @return {String}          config value for key.property
 */
exports.getConfig = (key, property) => {
  if (!(key in config) || (property !== undefined && !(property in config[key]))) {
    console.log(`${key}.${property} not found in config`);
  }

  if (!property) {
    return config[key]
  }
  return config[key][property]
}
