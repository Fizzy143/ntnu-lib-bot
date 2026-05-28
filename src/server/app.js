import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { checkAvailability } from '../usecases/checkAvailability.js';
import { bookRoom } from '../usecases/bookRoom.js';
import { getSession } from './sessionStore.js';
import { getPublicConfig } from './config.js';
import { setupCredentialsAPI } from './routes/credentials.js';
import { authenticateRequest, isAuthConfigured } from './auth.js';

const app = express();
let credentialsStore = null;

app.use(express.json());
app.use(authenticateRequest);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    ok: true,
    ...getPublicConfig(),
    auth: {
      configured: isAuthConfigured()
    }
  });
});

app.get('/api/availability', async (req, res) => {
  const date = String(req.query.date || '').trim();
  const branch = String(req.query.branch || process.env.DEFAULT_BRANCH || '').trim();
  const room = String(req.query.room || '').trim();

  if (!date || !branch) {
    return res.status(400).json({
      ok: false,
      message: 'date and branch are required'
    });
  }

  const result = await checkAvailability({ date, branch, room });
  return res.status(result.ok ? 200 : 500).json(result);
});

app.get('/api/book/captcha/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  const captchaPath = session?.captchaPath;

  if (!captchaPath) {
    return res.status(404).json({ ok: false, message: 'captcha session not found' });
  }

  return res.sendFile(path.resolve(captchaPath));
});

app.post('/api/book/start', async (req, res) => {
  const {
    branch,
    roomKeyword,
    date,
    start,
    end,
    people,
    username: requestUsername,
    password: requestPassword,
    userId: requestUserId,
    show = false,
    debug = false
  } = req.body ?? {};

  const userId = req.user?.id || requestUserId;
  const credentials = await resolveBookingCredentials({
    userId,
    username: requestUsername,
    password: requestPassword
  });

  if (!branch || !roomKeyword || !date || !start || !end || !credentials.username || !credentials.password) {
    return res.status(400).json({
      ok: false,
      message: 'branch, roomKeyword, date, start, end, and booking credentials are required'
    });
  }

  const sessionId = randomUUID();
  const result = await bookRoom({
    branch,
    roomKeyword,
    date,
    start,
    end,
    people,
    username: credentials.username,
    password: credentials.password,
    show,
    debug,
    manualCaptchaFallback: true,
    sessionKey: sessionId
  });

  if (result.code === 'captcha_needed') {
    return res.status(202).json({
      ok: false,
      status: 'captcha_required',
      sessionId,
      captchaPath: result.captchaPath,
      captchaUrl: `/api/book/captcha/${sessionId}`,
      pendingParams: result.pendingParams
    });
  }

  return res.status(result.ok ? 200 : 500).json({
    ...result,
    status: result.ok ? 'success' : 'failed'
  });
});

app.post('/api/book/captcha', async (req, res) => {
  const { sessionId, captchaCode, username, password, userId: requestUserId, show = false, debug = false } = req.body ?? {};

  if (!sessionId || !captchaCode) {
    return res.status(400).json({
      ok: false,
      message: 'sessionId and captchaCode are required'
    });
  }

  const credentials = await resolveBookingCredentials({
    userId: req.user?.id || requestUserId,
    username,
    password,
    allowMissing: true
  });

  const result = await bookRoom({
    captchaCode,
    username: credentials.username,
    password: credentials.password,
    show,
    debug,
    manualCaptchaFallback: true,
    sessionKey: sessionId
  });

  return res.status(result.ok ? 200 : 500).json({
    ...result,
    status: result.ok ? 'success' : 'failed'
  });
});

async function resolveBookingCredentials({ userId, username, password, allowMissing = false }) {
  const explicitUsername = String(username || '').trim();
  const explicitPassword = String(password || '');

  if (explicitUsername && explicitPassword) {
    return { username: explicitUsername, password: explicitPassword };
  }

  if (credentialsStore && userId) {
    const saved = await credentialsStore.getCredential(userId);
    if (saved) {
      return {
        username: saved.libraryUsername,
        password: saved.plainPassword
      };
    }
  }

  if (allowMissing) {
    return { username: explicitUsername, password: explicitPassword };
  }

  return { username: '', password: '' };
}

export function initializeCredentialsAPI(app, credentialsManager) {
  credentialsStore = credentialsManager;
  const credRouter = setupCredentialsAPI(credentialsManager);
  app.use(credRouter);
}

export default app;
