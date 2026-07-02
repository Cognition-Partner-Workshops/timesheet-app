const logger = require('./logger');

function getLog(req) {
  return req.log || logger;
}

module.exports = { getLog };
