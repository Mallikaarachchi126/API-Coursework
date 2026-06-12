const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');
const validate = require('../utils/validators');
const { badRequest } = require('../utils/errors');

const router = express.Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.body.nationalId || req.body.nid);
    const fullName = validate.required(req.body.fullName || req.body.name, 'fullName');
    const userRole = validate.role(req.body.role);
    const age = validate.age(req.body.age);
    const address = validate.required(req.body.address, 'address');
    const currentLatitude = validate.numberOrNull(req.body.currentLatitude, 'currentLatitude');
    const currentLongitude = validate.numberOrNull(req.body.currentLongitude, 'currentLongitude');
    const profession = validate.optionalString(req.body.profession);
    const affiliation = validate.optionalString(req.body.affiliation);
    const email = validate.email(req.body.email);
    const password = validate.required(req.body.password, 'password');

    if (password.length < 8) {
      throw badRequest('password must contain at least 8 characters');
    }

    const existing = await query(
      'SELECT id FROM Citizens WHERE national_id = @nationalId OR email = @email',
      { nationalId, email }
    );

    if (existing.recordset.length > 0) {
      throw badRequest('A citizen with this national ID or email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO Citizens (
        national_id, full_name, role, age, address, current_latitude, current_longitude,
        profession, affiliation, email, password_hash
      )
      OUTPUT INSERTED.id, INSERTED.national_id, INSERTED.full_name, INSERTED.role, INSERTED.email
      VALUES (
        @nationalId, @fullName, @role, @age, @address, @currentLatitude, @currentLongitude,
        @profession, @affiliation, @email, @passwordHash
      )`,
      {
        nationalId,
        fullName,
        role: userRole,
        age,
        address,
        currentLatitude,
        currentLongitude,
        profession,
        affiliation,
        email,
        passwordHash
      }
    );

    const citizen = result.recordset[0];
    const token = signToken({
      id: citizen.id,
      nationalId: citizen.national_id,
      fullName: citizen.full_name,
      role: citizen.role
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: citizen.id,
        nationalId: citizen.national_id,
        fullName: citizen.full_name,
        role: citizen.role,
        email: citizen.email
      }
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = validate.email(req.body.email);
    const password = validate.required(req.body.password, 'password');

    const result = await query(
      `SELECT id, national_id, full_name, role, email, password_hash, is_active
       FROM Citizens
       WHERE email = @email`,
      { email }
    );

    const user = result.recordset[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    const token = signToken({
      id: user.id,
      nationalId: user.national_id,
      fullName: user.full_name,
      role: user.role
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        nationalId: user.national_id,
        fullName: user.full_name,
        role: user.role,
        email: user.email
      }
    });
  })
);

module.exports = router;
