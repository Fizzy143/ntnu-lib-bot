import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax.js';

dayjs.extend(minMax);

export function normalizeSchedulerPayload(raw) {
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);

  return list
    .map(event => ({
      id: event.id ?? event.event_id ?? '',
      text: String(event.text ?? event.title ?? event.room ?? '').trim(),
      room: String(event.room ?? event.text ?? '').trim(),
      start: event.start_date ?? event.start ?? event.startDate ?? '',
      end: event.end_date ?? event.end ?? event.endDate ?? ''
    }))
    .filter(event => event.start && event.end);
}

export function filterByDate(list, ymd) {
  const startOfDay = dayjs(ymd).startOf('day');
  const endOfDay = dayjs(ymd).endOf('day');

  return list.filter(event => {
    const start = dayjs(event.start);
    const end = dayjs(event.end);
    return start.isBefore(endOfDay) && end.isAfter(startOfDay);
  });
}

export function groupByRoom(list) {
  const map = new Map();

  for (const event of list) {
    const key = event.room || guessRoomFromText(event.text);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(event);
  }

  for (const events of map.values()) {
    events.sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  }

  return map;
}

function guessRoomFromText(text) {
  const match = text.match(/(Room\s*\d+|\d{3})/i);
  return match ? match[0].replace(/\s+/g, '') : (text || 'UNKNOWN');
}

export function buildRoomBlocks(events, dateYmd) {
  const dayStart = dayjs(`${dateYmd} 08:00`);
  const dayEnd = dayjs(`${dateYmd} 22:00`);
  const blocks = [];
  let cursor = dayStart;

  for (const event of events) {
    const start = dayjs(event.start);
    const end = dayjs(event.end);

    if (start.isAfter(cursor)) {
      blocks.push({ type: 'FREE', start: cursor, end: start });
    }

    blocks.push({
      type: 'BUSY',
      start: dayjs.max(start, dayStart),
      end: dayjs.min(end, dayEnd)
    });

    cursor = dayjs.max(cursor, end);
  }

  if (cursor.isBefore(dayEnd)) {
    blocks.push({ type: 'FREE', start: cursor, end: dayEnd });
  }

  return blocks
    .filter(block => block.end.isAfter(block.start))
    .map(block => ({
      type: block.type,
      start: block.start.format('HH:mm'),
      end: block.end.format('HH:mm')
    }));
}

export function formatRoomTimeline(room, events, dateYmd) {
  const blocks = buildRoomBlocks(events, dateYmd);
  const lines = blocks.map(block => `${block.start}-${block.end} ${block.type}`);
  return `${room}\n${lines.join('\n')}`;
}

export function buildAvailabilityResponse({ branch, date, grouped }) {
  const rooms = Array.from(grouped.entries()).map(([room, events]) => ({
    room,
    events: events.map(event => ({
      id: event.id,
      text: event.text,
      start: dayjs(event.start).format('HH:mm'),
      end: dayjs(event.end).format('HH:mm')
    })),
    blocks: buildRoomBlocks(events, date),
    timeline: formatRoomTimeline(room, events, date)
  }));

  return {
    branch,
    date,
    roomCount: rooms.length,
    rooms
  };
}
