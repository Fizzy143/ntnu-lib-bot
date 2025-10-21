// checkAvailability.js
// 匯入 status_cli 的邏輯

import 'dotenv/config';
import axios from 'axios';
import dayjs from 'dayjs';
import { normalizeSchedulerPayload, filterByDate, groupByRoom, formatRoomTimeline } from '../cli/utils.js';

const BASE = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw/service';

export async function fetchSchedulerJson(branch) {
  const url = `${BASE}/roombooking/booksearch.booklst.jsp`;
  const res = await axios.get(url, { params: { forward_fg: 1, branch } });
  return res.data;
}

export async function checkAvailability({ date, branch, room }) {
  try {
    console.log(`Querying branch "${branch}" for ${date} ...`);

    const raw = await fetchSchedulerJson(branch);
    const events = normalizeSchedulerPayload(raw);
    const dayEvents = filterByDate(events, date);

    if (dayEvents.length === 0) {
      console.log('No events found for the given date (maybe closed or no data).');
      return { ok: true, events: [], message: 'No events found' };
    }

    const filtered = room
      ? dayEvents.filter(e =>
          [e.room, e.text].some(x => String(x).toLowerCase().includes(room.toLowerCase()))
        )
      : dayEvents;

    const grouped = groupByRoom(filtered);
    if (grouped.size === 0) {
      console.log(`No matching rooms for keyword "${room}".`);
      return { ok: true, rooms: [], message: 'No matching rooms' };
    }

    console.log(`\n=== ${branch} — ${date} ===`);
    const results = [];
    for (const [rm, evs] of grouped.entries()) {
      const timeline = formatRoomTimeline(rm, evs, date);
      console.log(timeline);
      console.log('');
      results.push({ room: rm, events: evs, timeline });
    }

    return { ok: true, results };
  } catch (err) {
    console.error('[status] failed:', err?.response?.status, err?.response?.statusText, err?.message);
    return { ok: false, error: err.message };
  }
}
