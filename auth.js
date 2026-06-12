const jwt = require('jsonwebtoken');
const { forbidden } = require('../utils/errors');

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      nid: user.nationalId,
      role: user.role,
      name: user.fullName
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Bearer token is required' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw forbidden(`Allowed roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
}

function allowCitizenOwnerOrRoles(paramName, ...allowedRoles) {
  return (req, res, next) => {
    const nid = String(req.params[paramName] || '').toUpperCase();
    if (req.user && (req.user.nid === nid || allowedRoles.includes(req.user.role))) {
      return next();
    }
    throw forbidden('Only the citizen owner or an authorized bureau role can access this record');
  };
}

module.exports = {
  signToken,
  requireAuth,
  allowRoles,
  allowCitizenOwnerOrRoles
};
