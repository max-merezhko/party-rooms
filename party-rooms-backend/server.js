/**
 * Express + HTTP server + Socket.io entrypoint.
 */

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const youtubeRoutes = require('./routes/youtube');
const roomsRoutes = require('./routes/rooms');
const queueRoutes = require('./routes/queue');
const leaderboardRoutes = require('./routes/leaderboard');
const { register: registerSocketHandlers } = require('./socket/handlers');

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/** Browser `Origin` is scheme+host+port only — no path. Normalize env URLs so
 *  https://user.github.io/project and https://user.github.io both become https://user.github.io */
function normalizeToOrigin(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    return u.origin;
  } catch {
    return null;
  }
}

function parseOrigins() {
  const fromEnv = [process.env.FRONTEND_URL_LOCAL, process.env.FRONTEND_URL_PROD]
    .map(normalizeToOrigin)
    .filter(Boolean);

  const unique = [...new Set(fromEnv)];

  if (unique.length === 0 && NODE_ENV !== 'production') {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return unique;
}

const allowedOrigins = parseOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

const app = express();

app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'party-rooms-backend', env: NODE_ENV });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, api: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api', queueRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

registerSocketHandlers(io);
app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`HTTP + Socket.io listening on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);
});
