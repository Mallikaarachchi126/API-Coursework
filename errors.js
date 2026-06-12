class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

function notFound(message = 'Resource not found') {
  return new AppError(message, 404);
}

function badRequest(message = 'Invalid request') {
  return new AppError(message, 400);
}

function forbidden(message = 'You are not allowed to perform this action') {
  return new AppError(message, 403);
}

module.exports = {
  AppError,
  notFound,
  badRequest,
  forbidden
};
