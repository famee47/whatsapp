require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const { initSocket } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === 'http://localhost:5173' || (origin && origin.endsWith('.vercel.app')) || origin === process.env.CLIENT_URL) return cb(null, true);
    cb(new Error('CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(rateLimit({ windowMs:15*60*1000, max:200, standardHeaders:true, legacyHeaders:false }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(mongoSanitize());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/statuses', require('./routes/statusRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '5.0', timestamp: new Date().toISOString() }));
app.use('*', (req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => { console.error(err); res.status(err.status||500).json({ message: err.message||'Internal server error' }); });

initSocket(server);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/numberfree')
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(process.env.PORT || 5000, () => console.log(`🚀 NumberFree v5 running on port ${process.env.PORT || 5000}`));
  })
  .catch(err => { console.error('❌ DB connection failed:', err.message); process.exit(1); });

process.on('unhandledRejection', err => { console.error('Unhandled:', err); });
module.exports = { app, server };
