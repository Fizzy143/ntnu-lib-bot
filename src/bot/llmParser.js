import axios from 'axios';
import { getTaipeiToday } from './naturalLanguage.js';
import { getBranchDefinitions } from '../shared/branches.js';

const BRANCH_DEFINITIONS = getBranchDefinitions();
const BOOKING_HINT = /(預約|借|訂|book|幫我約|幫我訂)/i;

export function isHermesParserConfigured() {
  return Boolean(String(process.env.HERMES_PARSE_URL || '').trim());
}

export function shouldUseHermesFallback(text, parsed) {
  const source = String(text || '').trim();
  if (!source || !isHermesParserConfigured()) {
    return false;
  }

  if (!parsed) {
    return true;
  }

  if (parsed.intent === 'book' && (!parsed.room || !parsed.start || !parsed.end)) {
    return true;
  }

  if (parsed.intent === 'status' && BOOKING_HINT.test(source)) {
    return true;
  }

  return false;
}

export async function parseLibraryMessageWithHermes(text, { today = getTaipeiToday() } = {}) {
  const source = String(text || '').trim();
  const url = String(process.env.HERMES_PARSE_URL || '').trim();

  if (!source || !url) {
    return null;
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  const token = String(process.env.HERMES_PARSE_TOKEN || '').trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const timeout = Number(process.env.HERMES_PARSE_TIMEOUT_MS || 8000);

  try {
    const response = await axios.post(url, buildHermesPayload(source, today), {
      headers,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 8000
    });

    const parsed = normalizeHermesResponse(response.data, { rawText: source, today });
    if (!parsed) {
      console.warn('[hermes parser] Ignored invalid parse response');
    }
    return parsed;
  } catch (error) {
    console.warn('[hermes parser] Request failed:', error.message);
    return null;
  }
}

function buildHermesPayload(text, today) {
  return {
    task: 'parse_ntnu_library_message',
    text,
    today,
    timezone: 'Asia/Taipei',
    branchOptions: BRANCH_DEFINITIONS.map(branch => ({
      canonical: branch.canonical,
      aliases: branch.aliases
    })),
    outputSchema: {
      intent: 'status | book',
      branch: '總館 | 公館分館 | 林口分館 | ""',
      room: 'room keyword or 3-digit room number',
      people: 'integer or null',
      date: 'YYYY-MM-DD',
      start: 'HH:MM',
      end: 'HH:MM'
    },
    rules: [
      'Return JSON only.',
      'Do not execute any booking action.',
      'If a field is uncertain, return an empty string instead of guessing.',
      'Use today when the user does not specify a date.'
    ]
  };
}

function normalizeHermesResponse(payload, { rawText, today }) {
  const candidate = extractCandidate(payload);
  if (!candidate) {
    return null;
  }

  const intent = normalizeIntent(candidate.intent);
  if (!intent) {
    return null;
  }

  const parsed = {
    intent,
    branch: normalizeBranch(candidate.branch),
    room: normalizeRoom(candidate.room),
    people: normalizePeople(candidate.people),
    date: normalizeDate(candidate.date, today),
    start: normalizeTime(candidate.start),
    end: normalizeTime(candidate.end),
    rawText,
    parser: 'hermes'
  };

  if (parsed.intent === 'status') {
    parsed.start = '';
    parsed.end = '';
  }

  return parsed;
}

function extractCandidate(payload) {
  if (!isPlainObject(payload)) {
    return null;
  }

  if (isPlainObject(payload.parsed)) {
    return payload.parsed;
  }

  if (isPlainObject(payload.result)) {
    return payload.result;
  }

  if (isPlainObject(payload.data?.parsed)) {
    return payload.data.parsed;
  }

  if (isPlainObject(payload.data)) {
    return payload.data;
  }

  return payload;
}

function normalizeIntent(value) {
  const source = String(value || '').trim().toLowerCase();
  if (!source) {
    return '';
  }

  if (['status', 'availability', 'check', 'query'].includes(source)) {
    return 'status';
  }

  if (['book', 'booking', 'reserve', 'reservation'].includes(source)) {
    return 'book';
  }

  if (/(查|看看|有沒有|空房|availability)/i.test(source)) {
    return 'status';
  }

  if (BOOKING_HINT.test(source)) {
    return 'book';
  }

  return '';
}

function normalizeBranch(value) {
  const source = String(value || '').trim();
  if (!source) {
    return '';
  }

  for (const branch of BRANCH_DEFINITIONS) {
    if (source === branch.canonical) {
      return branch.canonical;
    }

    if (branch.aliases.includes(source) || branch.aliases.some(alias => source.includes(alias))) {
      return branch.canonical;
    }
  }

  return '';
}

function normalizeRoom(value) {
  const source = String(value || '').trim();
  if (!source) {
    return '';
  }

  const numberMatch = source.match(/\b([1-9]\d{2})\b/);
  if (numberMatch) {
    return numberMatch[1];
  }

  return source.slice(0, 20);
}

function normalizePeople(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    return null;
  }

  return number;
}

function normalizeDate(value, today) {
  const source = String(value || '').trim();
  if (!source) {
    return today;
  }

  const match = source.match(/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) {
    return today;
  }

  return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;
}

function normalizeTime(value) {
  const source = String(value || '').trim();
  if (!source) {
    return '';
  }

  const match = source.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) {
    return '';
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }

  return `${pad2(hour)}:${pad2(minute)}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
