function errorHandler(error, req, res, next) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Uploaded file is too large. Maximum size is 5 MB.' });
  }

  const statusCode = error.statusCode || 500;
  const response = {
    message: statusCode === 500 ? 'Internal server error' : error.message,
    requestId: req.requestId
  };

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.details = error.message;
  }

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;
