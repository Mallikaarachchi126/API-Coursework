require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const citizenRoutes = require('./routes/citizen.routes');
const complaintRoutes = require('./routes/complaint.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const errorHandler = require('./middleware/errorHandler');
const requestContext = require('./middleware/requestContext');

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(requestContext);
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SLBFE REST API',
    version: '2.0.0',
    requestId: req.requestId,
    features: ['jwt-auth', 'role-based-access', 'document-upload', 'candidate-match', 'analytics'],
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/citizens', citizenRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`SLBFE API running on http://localhost:${port}`);
});
