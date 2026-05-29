import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

let writeQueue = Promise.resolve();

export function isParserFeedbackEnabled() {
  return String(process.env.PARSER_FEEDBACK_ENABLED || 'true').toLowerCase() !== 'false';
}

export function getParserFeedbackLogPath() {
  const configured = String(process.env.PARSER_FEEDBACK_LOG_PATH || '.local/natural-language-feedback.jsonl').trim();
  return path.resolve(process.cwd(), configured);
}

export function recordParserFeedback(event) {
  if (!isParserFeedbackEnabled()) {
    return Promise.resolve();
  }

  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };

  writeQueue = writeQueue
    .catch(() => {})
    .then(() => writeEntry(entry))
    .catch(error => {
      console.warn('[parser feedback] Failed to persist feedback:', error.message);
    });

  return writeQueue;
}

async function writeEntry(entry) {
  const logPath = getParserFeedbackLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}
