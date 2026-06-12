const express = require('express');
const path = require('path');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const upload = require('../middleware/upload');
const { requireAuth, allowRoles, allowCitizenOwnerOrRoles } = require('../middleware/auth');
const validate = require('../utils/validators');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();

function mapCitizen(row) {
  if (!row) return null;
  return {
    id: row.id,
    nationalId: row.national_id,
    fullName: row.full_name,
    role: row.role,
    age: row.age,
    address: row.address,
    currentLocation: {
      latitude: row.current_latitude,
      longitude: row.current_longitude
    },
    profession: row.profession,
    affiliation: row.affiliation,
    email: row.email,
    isVerified: row.is_verified,
    verificationNotes: row.verification_notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getCitizenOrThrow(nationalId) {
  const result = await query(
    `SELECT id, national_id, full_name, role, age, address, current_latitude, current_longitude,
      profession, affiliation, email, is_verified, verification_notes, is_active, created_at, updated_at
     FROM Citizens
     WHERE national_id = @nationalId`,
    { nationalId }
  );

  if (!result.recordset[0]) {
    throw notFound('Citizen not found');
  }

  return result.recordset[0];
}

router.get(
  '/find',
  requireAuth,
  allowRoles('company', 'officer', 'staff'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = validate.pagination(req.query);
    const qualification = validate.optionalString(req.query.qualification);
    const profession = validate.optionalString(req.query.profession);

    const result = await query(
      `SELECT c.id, c.national_id, c.full_name, c.role, c.profession, c.email,
          c.current_latitude, c.current_longitude, c.is_verified,
          STRING_AGG(q.qualification_name, ', ') AS qualifications,
          CASE
            WHEN @qualification IS NOT NULL AND @profession IS NOT NULL
              AND c.profession LIKE '%' + @profession + '%'
              AND SUM(CASE WHEN q.qualification_name LIKE '%' + @qualification + '%' THEN 1 ELSE 0 END) > 0 THEN 100
            WHEN @qualification IS NOT NULL
              AND SUM(CASE WHEN q.qualification_name LIKE '%' + @qualification + '%' THEN 1 ELSE 0 END) > 0 THEN 80
            WHEN @profession IS NOT NULL AND c.profession LIKE '%' + @profession + '%' THEN 60
            ELSE 40
          END AS match_score,
          COUNT(*) OVER() AS total_count
       FROM Citizens c
       LEFT JOIN Qualifications q ON q.citizen_id = c.id
       WHERE c.is_active = 1
         AND c.is_verified = 1
         AND c.role IN ('citizen', 'job_seeker')
         AND (@profession IS NULL OR c.profession LIKE '%' + @profession + '%')
         AND (@qualification IS NULL OR q.qualification_name LIKE '%' + @qualification + '%')
       GROUP BY c.id, c.national_id, c.full_name, c.role, c.profession, c.email,
          c.current_latitude, c.current_longitude, c.is_verified
       ORDER BY match_score DESC, c.full_name
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { profession, qualification, offset, limit }
    );

    const total = result.recordset[0]?.total_count || 0;
    res.json({
      page,
      limit,
      total,
      data: result.recordset.map((row) => ({
        id: row.id,
        nationalId: row.national_id,
        fullName: row.full_name,
        role: row.role,
        profession: row.profession,
        email: row.email,
        currentLocation: {
          latitude: row.current_latitude,
          longitude: row.current_longitude
        },
        isVerified: row.is_verified,
        qualifications: row.qualifications ? row.qualifications.split(', ') : [],
        matchScore: row.match_score
      }))
    });
  })
);

router.get(
  '/:nid',
  requireAuth,
  allowCitizenOwnerOrRoles('nid', 'officer', 'staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const citizen = await getCitizenOrThrow(nationalId);

    const [qualifications, documents, contacts] = await Promise.all([
      query('SELECT id, qualification_name, institution, year_completed FROM Qualifications WHERE citizen_id = @id', {
        id: citizen.id
      }),
      query('SELECT id, document_type, original_name, stored_name, uploaded_at FROM CitizenDocuments WHERE citizen_id = @id', {
        id: citizen.id
      }),
      query('SELECT id, contact_name, relationship, phone, email, address FROM CitizenContacts WHERE citizen_id = @id', {
        id: citizen.id
      })
    ]);

    res.json({
      data: {
        ...mapCitizen(citizen),
        qualifications: qualifications.recordset.map((row) => ({
          id: row.id,
          name: row.qualification_name,
          institution: row.institution,
          yearCompleted: row.year_completed
        })),
        documents: documents.recordset.map((row) => ({
          id: row.id,
          type: row.document_type,
          originalName: row.original_name,
          storedName: row.stored_name,
          uploadedAt: row.uploaded_at
        })),
        contacts: contacts.recordset.map((row) => ({
          id: row.id,
          name: row.contact_name,
          relationship: row.relationship,
          phone: row.phone,
          email: row.email,
          address: row.address
        }))
      }
    });
  })
);

router.put(
  '/:nid/profile',
  requireAuth,
  allowCitizenOwnerOrRoles('nid', 'officer', 'staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const citizen = await getCitizenOrThrow(nationalId);
    const address = validate.optionalString(req.body.address);
    const profession = validate.optionalString(req.body.profession);
    const affiliation = validate.optionalString(req.body.affiliation);
    const currentLatitude = validate.numberOrNull(req.body.currentLatitude, 'currentLatitude');
    const currentLongitude = validate.numberOrNull(req.body.currentLongitude, 'currentLongitude');
    const qualifications = Array.isArray(req.body.qualifications) ? req.body.qualifications : [];

    await query(
      `UPDATE Citizens
       SET address = COALESCE(@address, address),
           profession = COALESCE(@profession, profession),
           affiliation = COALESCE(@affiliation, affiliation),
           current_latitude = COALESCE(@currentLatitude, current_latitude),
           current_longitude = COALESCE(@currentLongitude, current_longitude),
           updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
      { id: citizen.id, address, profession, affiliation, currentLatitude, currentLongitude }
    );

    for (const item of qualifications) {
      const name = validate.required(item.name || item.qualificationName, 'qualification name');
      await query(
        `INSERT INTO Qualifications (citizen_id, qualification_name, institution, year_completed)
         VALUES (@citizenId, @name, @institution, @yearCompleted)`,
        {
          citizenId: citizen.id,
          name,
          institution: validate.optionalString(item.institution),
          yearCompleted: validate.numberOrNull(item.yearCompleted, 'yearCompleted')
        }
      );
    }

    const updated = await getCitizenOrThrow(nationalId);
    res.json({ message: 'Profile updated', data: mapCitizen(updated) });
  })
);

router.put(
  '/:nid/location',
  requireAuth,
  allowCitizenOwnerOrRoles('nid', 'officer', 'staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const currentLatitude = validate.numberOrNull(req.body.currentLatitude, 'currentLatitude');
    const currentLongitude = validate.numberOrNull(req.body.currentLongitude, 'currentLongitude');

    if (currentLatitude === null || currentLongitude === null) {
      throw badRequest('currentLatitude and currentLongitude are required');
    }

    await query(
      `UPDATE Citizens
       SET current_latitude = @currentLatitude,
           current_longitude = @currentLongitude,
           updated_at = SYSUTCDATETIME()
       WHERE national_id = @nationalId`,
      { nationalId, currentLatitude, currentLongitude }
    );

    res.json({ message: 'Location updated' });
  })
);

router.post(
  '/:nid/documents',
  requireAuth,
  allowCitizenOwnerOrRoles('nid', 'officer', 'staff'),
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const citizen = await getCitizenOrThrow(nationalId);
    const documentType = validate.required(req.body.documentType, 'documentType');

    if (!req.file) {
      throw badRequest('document file is required');
    }

    const result = await query(
      `INSERT INTO CitizenDocuments (
        citizen_id, document_type, original_name, stored_name, file_path, mime_type, file_size
       )
       OUTPUT INSERTED.id, INSERTED.document_type, INSERTED.original_name, INSERTED.stored_name, INSERTED.uploaded_at
       VALUES (@citizenId, @documentType, @originalName, @storedName, @filePath, @mimeType, @fileSize)`,
      {
        citizenId: citizen.id,
        documentType,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: path.relative(process.cwd(), req.file.path),
        mimeType: req.file.mimetype,
        fileSize: req.file.size
      }
    );

    res.status(201).json({ message: 'Document uploaded', data: result.recordset[0] });
  })
);

router.put(
  '/:nid/verify',
  requireAuth,
  allowRoles('officer', 'staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const isVerified = Boolean(req.body.isVerified);
    const verificationNotes = validate.optionalString(req.body.verificationNotes);

    const result = await query(
      `UPDATE Citizens
       SET is_verified = @isVerified,
           verification_notes = @verificationNotes,
           verified_by = @verifiedBy,
           verified_at = SYSUTCDATETIME(),
           updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.national_id, INSERTED.full_name, INSERTED.is_verified, INSERTED.verification_notes
       WHERE national_id = @nationalId`,
      { nationalId, isVerified, verificationNotes, verifiedBy: req.user.id }
    );

    if (!result.recordset[0]) {
      throw notFound('Citizen not found');
    }

    res.json({ message: 'Verification status updated', data: result.recordset[0] });
  })
);

router.delete(
  '/:nid',
  requireAuth,
  allowRoles('staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const result = await query(
      `UPDATE Citizens
       SET is_active = 0, deactivated_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.national_id, INSERTED.full_name, INSERTED.is_active
       WHERE national_id = @nationalId`,
      { nationalId }
    );

    if (!result.recordset[0]) {
      throw notFound('Citizen not found');
    }

    res.json({ message: 'Citizen account deactivated', data: result.recordset[0] });
  })
);

router.get(
  '/:nid/contacts',
  requireAuth,
  allowCitizenOwnerOrRoles('nid', 'officer', 'staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const citizen = await getCitizenOrThrow(nationalId);
    const result = await query(
      'SELECT id, contact_name, relationship, phone, email, address FROM CitizenContacts WHERE citizen_id = @citizenId',
      { citizenId: citizen.id }
    );

    res.json({ data: result.recordset });
  })
);

router.post(
  '/:nid/contacts',
  requireAuth,
  allowCitizenOwnerOrRoles('nid', 'officer', 'staff'),
  asyncHandler(async (req, res) => {
    const nationalId = validate.nid(req.params.nid);
    const citizen = await getCitizenOrThrow(nationalId);
    const contactName = validate.required(req.body.contactName, 'contactName');
    const relationship = validate.required(req.body.relationship, 'relationship');
    const phone = validate.required(req.body.phone, 'phone');
    const email = validate.optionalString(req.body.email);
    const address = validate.optionalString(req.body.address);

    const result = await query(
      `INSERT INTO CitizenContacts (citizen_id, contact_name, relationship, phone, email, address)
       OUTPUT INSERTED.id, INSERTED.contact_name, INSERTED.relationship, INSERTED.phone, INSERTED.email, INSERTED.address
       VALUES (@citizenId, @contactName, @relationship, @phone, @email, @address)`,
      { citizenId: citizen.id, contactName, relationship, phone, email, address }
    );

    res.status(201).json({ message: 'Contact added', data: result.recordset[0] });
  })
);

module.exports = router;
