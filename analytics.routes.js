const express = require('express');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/overview',
  requireAuth,
  allowRoles('officer', 'staff'),
  asyncHandler(async (req, res) => {
    const [citizens, complaints, documents, qualifications] = await Promise.all([
      query(
        `SELECT
          COUNT(*) AS totalCitizens,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeCitizens,
          SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) AS verifiedCitizens,
          SUM(CASE WHEN role = 'job_seeker' THEN 1 ELSE 0 END) AS jobSeekers,
          SUM(CASE WHEN role = 'company' THEN 1 ELSE 0 END) AS companies
         FROM Citizens`
      ),
      query(
        `SELECT
          COUNT(*) AS totalComplaints,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS openComplaints,
          SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS repliedComplaints,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closedComplaints
         FROM Complaints`
      ),
      query('SELECT COUNT(*) AS totalDocuments FROM CitizenDocuments'),
      query('SELECT COUNT(*) AS totalQualifications FROM Qualifications')
    ]);

    const c = citizens.recordset[0];
    const co = complaints.recordset[0];
    const verifiedRate =
      c.totalCitizens > 0 ? Math.round((Number(c.verifiedCitizens || 0) / Number(c.totalCitizens)) * 100) : 0;

    res.json({
      data: {
        citizens: {
          total: Number(c.totalCitizens || 0),
          active: Number(c.activeCitizens || 0),
          verified: Number(c.verifiedCitizens || 0),
          jobSeekers: Number(c.jobSeekers || 0),
          companies: Number(c.companies || 0),
          verifiedRate
        },
        complaints: {
          total: Number(co.totalComplaints || 0),
          open: Number(co.openComplaints || 0),
          replied: Number(co.repliedComplaints || 0),
          closed: Number(co.closedComplaints || 0)
        },
        documents: {
          total: Number(documents.recordset[0].totalDocuments || 0)
        },
        qualifications: {
          total: Number(qualifications.recordset[0].totalQualifications || 0)
        }
      }
    });
  })
);

router.get(
  '/top-qualifications',
  requireAuth,
  allowRoles('officer', 'staff', 'company'),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT TOP 10
        q.qualification_name AS qualification,
        COUNT(*) AS candidateCount
       FROM Qualifications q
       INNER JOIN Citizens c ON c.id = q.citizen_id
       WHERE c.is_active = 1 AND c.is_verified = 1
       GROUP BY q.qualification_name
       ORDER BY candidateCount DESC, q.qualification_name ASC`
    );

    res.json({
      data: result.recordset.map((row) => ({
        qualification: row.qualification,
        candidateCount: Number(row.candidateCount)
      }))
    });
  })
);

module.exports = router;
