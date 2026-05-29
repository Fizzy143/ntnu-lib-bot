import { getBranchDefinitions } from '../shared/branches.js';

const BRANCH_ALIASES = getBranchDefinitions();
const WEEKDAY_INDEX = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6
};

export function getTaipeiToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei'
  }).format(new Date());
}

export function parseLibraryMessage(text, { today = getTaipeiToday() } = {}) {
  const source = String(text || '').trim();
  if (!source) {
    return null;
  }

  const branch = parseBranch(source);
  const room = parseRoom(source);
  const people = parsePeople(source);
  const date = parseDate(source, today);
  const timeRange = parseTimeRange(source);
  const intent = detectIntent(source, {
    branch,
    room,
    people,
    dateMentioned: hasExplicitDateReference(source),
    hasTimeRange: Boolean(timeRange)
  });
  if (!intent) {
    return null;
  }

  return {
    intent,
    branch,
    room,
    people,
    date,
    start: timeRange?.start || '',
    end: timeRange?.end || '',
    rawText: source
  };
}

function detectIntent(text, context = {}) {
  if (/(查|看看|有沒有|空的|空房|哪些|status|availability)/i.test(text)) {
    return 'status';
  }

  if (/(預約|借|訂|book|幫我約|幫我訂)/i.test(text)) {
    return 'book';
  }

  if (shouldInferImplicitStatus(context)) {
    return 'status';
  }

  return null;
}

function shouldInferImplicitStatus({ branch, room, people, dateMentioned, hasTimeRange }) {
  if (people || hasTimeRange) {
    return false;
  }

  const signalCount = [Boolean(branch), Boolean(room), Boolean(dateMentioned)]
    .filter(Boolean)
    .length;

  return signalCount >= 2;
}

function parseBranch(text) {
  for (const branch of BRANCH_ALIASES) {
    if (branch.aliases.some(alias => text.includes(alias))) {
      return branch.canonical;
    }
  }

  return '';
}

function parseRoom(text) {
  const match = text.match(/\b([1-9]\d{2})\b/);
  return match ? match[1] : '';
}

function parsePeople(text) {
  const match = text.match(/(\d{1,2})\s*(人|個人)/);
  return match ? Number(match[1]) : null;
}

function parseDate(text, todayYmd) {
  const today = parseTaipeiDate(todayYmd);

  if (/今天|今晚/.test(text)) {
    return formatDate(today);
  }

  if (/明天|明晚/.test(text)) {
    return formatDate(addDays(today, 1));
  }

  if (text.includes('後天')) {
    return formatDate(addDays(today, 2));
  }

  const weekday = text.match(/(?:這|本|下)?(?:週|星期|禮拜)([日天一二三四五六])/);
  if (weekday) {
    const target = WEEKDAY_INDEX[weekday[1]];
    const current = today.getDay();
    let diff = (target - current + 7) % 7;

    if (text.includes('下')) {
      diff = diff === 0 ? 7 : diff + 7;
    }

    return formatDate(addDays(today, diff));
  }

  const full = text.match(/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/);
  if (full) {
    return `${full[1]}-${pad2(full[2])}-${pad2(full[3])}`;
  }

  const short = text.match(/(\d{1,2})[/-](\d{1,2})/);
  if (short) {
    return `${today.getFullYear()}-${pad2(short[1])}-${pad2(short[2])}`;
  }

  return todayYmd;
}

function hasExplicitDateReference(text) {
  return (
    /今天|今晚|明天|明晚|後天/.test(text)
    || /(?:這|本|下)?(?:週|星期|禮拜)[日天一二三四五六]/.test(text)
    || /(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/.test(text)
    || /(\d{1,2})[/-](\d{1,2})/.test(text)
  );
}

function parseTimeRange(text) {
  const withoutDates = text.replace(/20\d{2}[/-]\d{1,2}[/-]\d{1,2}/g, ' ');
  const direct = withoutDates.match(/(\d{1,2})(?::(\d{2}))?\s*(?:到|-|~|至)\s*(\d{1,2})(?::(\d{2}))?/);
  if (direct) {
    return {
      start: to24Hour(direct[1], direct[2], text),
      end: to24Hour(direct[3], direct[4], text)
    };
  }

  const chinese = withoutDates.match(/([上下早晚中午凌晨]{0,2})\s*(\d{1,2})點(?:半|(\d{1,2})分)?\s*(?:到|至)\s*([上下早晚中午凌晨]{0,2})?\s*(\d{1,2})點(?:半|(\d{1,2})分)?/);
  if (chinese) {
    const startMinute = text.includes('半') && !chinese[3] ? '30' : (chinese[3] || '');
    const endMinute = chinese[6] || '';
    return {
      start: to24Hour(chinese[2], startMinute, `${chinese[1] || ''} ${text}`),
      end: to24Hour(chinese[5], endMinute, chinese[4] || text)
    };
  }

  return null;
}

function to24Hour(hourText, minuteText, context) {
  let hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;
  const hint = String(context || '');

  if (/(下午|晚上|今晚|明晚)/.test(hint) && hour < 12) {
    hour += 12;
  }

  if (/中午/.test(hint) && hour < 11) {
    hour += 12;
  }

  if (/凌晨/.test(hint) && hour === 12) {
    hour = 0;
  }

  return `${pad2(hour)}:${pad2(minute)}`;
}

function parseTaipeiDate(ymd) {
  return new Date(`${ymd}T00:00:00+08:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function buildIntentSummary(parsed) {
  if (parsed.intent === 'status') {
    return `查詢 ${parsed.branch || '預設館別'} ${parsed.date}${parsed.room ? `，房間關鍵字 ${parsed.room}` : ''}`;
  }

  return `預約 ${parsed.branch || '預設館別'} ${parsed.room || '未指定房間'} ${parsed.date} ${parsed.start}-${parsed.end}${parsed.people ? `，${parsed.people} 人` : ''}`;
}
