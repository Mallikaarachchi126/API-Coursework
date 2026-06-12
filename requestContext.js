const crypto = require('crypto');

function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

module.exports = requestContext;
