var config = require('../config')

exports.getConfig = (key, property) => {
  if (!(key in config) || (property !== undefined && !(property in config[key]))) {
    console.log(`${key}.${property} not found in config`);
  }

  if (!property) {
    return config[key]
  } else {
    return config[key][property]
  }
}
