const express = require('express');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, allowRoles } = require('../middleware/auth');
const validate = require('../utils/validators');
const { notFound } = require('../utils/errors');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const subject = validate.required(req.body.subject, 'subject');
    const content = validate.required(req.body.content, 'content');

    const result = await query(
      `INSERT INTO Complaints (citizen_id, subject, content)
       OUTPUT INSERTED.id, INSERTED.subject, INSERTED.content, INSERTED.status, INSERTED.created_at
       VALUES (@citizenId, @subject, @content)`,
      { citizenId: req.user.id, subject, content }
    );

    res.status(201).json({ message: 'Complaint submitted', data: result.recordset[0] });
  })
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = validate.pagination(req.query);
    const status = validate.optionalString(req.query.status);
    const officerRoles = ['officer', 'staff'];

    const result = await query(
      `SELECT co.id, co.subject, co.content, co.reply, co.status, co.created_at, co.replied_at,
          c.national_id, c.full_name,
          COUNT(*) OVER() AS total_count
       FROM Complaints co
       INNER JOIN Citizens c ON c.id = co.citizen_id
       WHERE (@status IS NULL OR co.status = @status)
         AND (@canViewAll = 1 OR co.citizen_id = @citizenId)
       ORDER BY co.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      {
        status,
        canViewAll: officerRoles.includes(req.user.role) ? 1 : 0,
        citizenId: req.user.id,
        offset,
        limit
      }
    );

    const total = result.recordset[0]?.total_count || 0;
    res.json({
      page,
      limit,
      total,
      data: result.recordset.map((row) => ({
        id: row.id,
        subject: row.subject,
        content: row.content,
        reply: row.reply,
        status: row.status,
        createdAt: row.created_at,
        repliedAt: row.replied_at,
        citizen: {
          nationalId: row.national_id,
          fullName: row.full_name
        }
      }))
    });
  })
);

router.put(
  '/:id/reply',
  requireAuth,
  allowRoles('officer', 'staff'),
  asyncHandler(async (req, res) => {
    const complaintId = Number.parseInt(req.params.id, 10);
    const reply = validate.required(req.body.reply, 'reply');
    const status = validate.optionalString(req.body.status) || 'replied';

    const result = await query(
      `UPDATE Complaints
       SET reply = @reply,
           status = @status,
           replied_by = @repliedBy,
           replied_at = SYSUTCDATETIME()
       OUTPUT INSERTED.id, INSERTED.subject, INSERTED.reply, INSERTED.status, INSERTED.replied_at
       WHERE id = @complaintId`,
      { complaintId, reply, status, repliedBy: req.user.id }
    );

    if (!result.recordset[0]) {
      throw notFound('Complaint not found');
    }

    res.json({ message: 'Complaint replied', data: result.recordset[0] });
  })
);

module.exports = router;
