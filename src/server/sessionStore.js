const sessions = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function isExpired(session) {
  return !session || session.expiresAt <= Date.now();
}

export function saveSession(sessionId, value, ttlMs = DEFAULT_TTL_MS) {
  sessions.set(sessionId, {
    ...value,
    expiresAt: Date.now() + ttlMs
  });
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (isExpired(session)) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

export function cleanupExpiredSessions() {
  for (const [sessionId, session] of sessions.entries()) {
    if (isExpired(session)) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 1000).unref?.();
