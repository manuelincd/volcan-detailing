const { env } = require('./config/env');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const serviceRoutes = require('./routes/services');
const userRoutes = require('./routes/users');
const availabilityRoutes = require('./routes/availability');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => console.log(`Server running on port ${env.PORT}`));

module.exports = app;
