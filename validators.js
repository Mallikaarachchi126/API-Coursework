const validator = require('validator');
const { badRequest } = require('./errors');

const roles = ['citizen', 'job_seeker', 'officer', 'company', 'staff'];

function required(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw badRequest(`${fieldName} is required`);
  }
  return String(value).trim();
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function email(value) {
  const text = required(value, 'email');
  if (!validator.isEmail(text)) {
    throw badRequest('email must be valid');
  }
  return text.toLowerCase();
}

function nid(value) {
  const text = required(value, 'national ID');
  if (!/^[A-Za-z0-9-]{5,20}$/.test(text)) {
    throw badRequest('national ID must be 5-20 letters, numbers, or hyphens');
  }
  return text.toUpperCase();
}

function age(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 16 || number > 100) {
    throw badRequest('age must be a whole number between 16 and 100');
  }
  return number;
}

function numberOrNull(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw badRequest(`${fieldName} must be a number`);
  }
  return number;
}

function role(value) {
  const text = optionalString(value) || 'citizen';
  if (!roles.includes(text)) {
    throw badRequest(`role must be one of: ${roles.join(', ')}`);
  }
  return text;
}

function pagination(query) {
  const page = Math.max(Number.parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || '10', 10), 1), 50);
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

module.exports = {
  roles,
  required,
  optionalString,
  email,
  nid,
  age,
  numberOrNull,
  role,
  pagination
};
