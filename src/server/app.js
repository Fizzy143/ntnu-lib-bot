import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { checkAvailability } from '../usecases/checkAvailability.js';
import { bookRoom } from '../usecases/bookRoom.js';
import { getSession } from './sessionStore.js';
import { getPublicConfig } from './config.js';

const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    ok: true,
    ...getPublicConfig()
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
    username,
    password,
    show = false,
    debug = false
  } = req.body ?? {};

  if (!branch || !roomKeyword || !date || !start || !end || !username || !password) {
    return res.status(400).json({
      ok: false,
      message: 'branch, roomKeyword, date, start, end, username, and password are required'
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
    username,
    password,
    show,
    debug,
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
  const { sessionId, captchaCode, username, password, show = false, debug = false } = req.body ?? {};

  if (!sessionId || !captchaCode) {
    return res.status(400).json({
      ok: false,
      message: 'sessionId and captchaCode are required'
    });
  }

  const result = await bookRoom({
    captchaCode,
    username,
    password,
    show,
    debug,
    sessionKey: sessionId
  });

  return res.status(result.ok ? 200 : 500).json({
    ...result,
    status: result.ok ? 'success' : 'failed'
  });
});

export default app;
