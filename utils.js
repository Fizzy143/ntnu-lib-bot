import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax.js';
dayjs.extend(minMax);

export function normalizeSchedulerPayload(raw) {
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  return list.map(ev => ({
    id: ev.id ?? ev.event_id ?? '',
    text: String(ev.text ?? ev.title ?? ev.room ?? '').trim(),
    room: String(ev.room ?? ev.text ?? '').trim(),
    start: ev.start_date ?? ev.start ?? ev.startDate ?? '',
    end: ev.end_date ?? ev.end ?? ev.endDate ?? '',
  })).filter(e => e.start && e.end);
}

export function filterByDate(list, ymd) {
  const startOfDay = dayjs(ymd).startOf('day');
  const endOfDay = dayjs(ymd).endOf('day');
  return list.filter(e => {
    const s = dayjs(e.start);
    const t = dayjs(e.end);
    return s.isBefore(endOfDay) && t.isAfter(startOfDay);
  });
}

export function groupByRoom(list) {
  const map = new Map();
  for (const e of list) {
    const key = e.room || guessRoomFromText(e.text);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  for (const arr of map.values()) {
    arr.sort((a,b)=> dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  }
  return map;
}

function guessRoomFromText(txt) {
  const m = txt.match(/(Room\s*\d+|\d{3}\s*團討室)/i);
  return m ? m[0].replace(/\s+/g, '') : (txt || 'UNKNOWN');
}

export function formatRoomTimeline(room, events, dateYmd) {
  const dayStart = dayjs(`${dateYmd} 08:00`);
  const dayEnd   = dayjs(`${dateYmd} 22:00`);
  const blocks = [];
  let cursor = dayStart;

  for (const e of events) {
    const s = dayjs(e.start);
    const t = dayjs(e.end);
    if (s.isAfter(cursor)) blocks.push({ type: 'FREE', start: cursor, end: s });
    blocks.push({ type: 'BUSY', start: dayjs.max(s, dayStart), end: dayjs.min(t, dayEnd) });
    cursor = dayjs.max(cursor, t);
}
if (cursor.isBefore(dayEnd)) blocks.push({ type: 'FREE', start: cursor, end: dayEnd });

const lines = blocks.map(b => `${b.start.format('HH:mm')}-${b.end.format('HH:mm')} ${b.type==='FREE'?'可借':'已被預訂'}`);
return `【${room}】\n` + lines.join('\n');
}

