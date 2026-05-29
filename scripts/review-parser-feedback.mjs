import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getParserFeedbackLogPath } from '../src/bot/parserFeedbackStore.js';

const logPath = getParserFeedbackLogPath();

if (!existsSync(logPath)) {
  console.log(`No parser feedback log found at ${logPath}`);
  process.exit(0);
}

const raw = await readFile(logPath, 'utf8');
const entries = raw
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

if (!entries.length) {
  console.log(`Parser feedback log is empty: ${logPath}`);
  process.exit(0);
}

const groups = new Map();

for (const entry of entries) {
  const key = JSON.stringify({
    reason: entry.reason || '',
    text: entry.text || '',
    missingFields: entry.missingFields || []
  });
  const current = groups.get(key) || {
    count: 0,
    reason: entry.reason || '',
    text: entry.text || '',
    latest: entry.timestamp || '',
    missingFields: entry.missingFields || [],
    parser: entry.parser || '',
    hermesAttempted: false
  };

  current.count += 1;
  current.latest = current.latest > (entry.timestamp || '') ? current.latest : (entry.timestamp || '');
  current.parser = entry.parser || current.parser;
  current.hermesAttempted = current.hermesAttempted || Boolean(entry.hermesAttempted);
  groups.set(key, current);
}

const sorted = [...groups.values()]
  .sort((a, b) => b.count - a.count || String(b.latest).localeCompare(String(a.latest)));

console.log(`Loaded ${entries.length} feedback entries from ${logPath}`);
console.log(`Unique cases: ${sorted.length}`);
console.log('');

for (const item of sorted.slice(0, 50)) {
  console.log(`count=${item.count} latest=${item.latest} reason=${item.reason} parser=${item.parser || 'none'} hermes=${item.hermesAttempted ? 'yes' : 'no'}`);
  if (item.missingFields?.length) {
    console.log(`missing=${item.missingFields.join(',')}`);
  }
  console.log(item.text);
  console.log('');
}
