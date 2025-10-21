import 'dotenv/config';
import axios from 'axios';
import dayjs from 'dayjs';
import { normalizeSchedulerPayload, filterByDate, groupByRoom, formatRoomTimeline } from './utils.js';

const BASE = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw/service';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, def='') => {
    const i = args.findIndex(a => a===`--${k}` || a===`-${k[0]}`);
    if (i>=0) return args[i+1] ?? def;
    return def;
  };
  const date = get('date') || dayjs().format('YYYY-MM-DD');
  const branch = get('branch') || process.env.DEFAULT_BRANCH || '總館';
  const room = get('room') || '';
  return { date, branch, room };
}

async function fetchSchedulerJson(branch) {
  const url = `${BASE}/roombooking/booksearch.booklst.jsp`;
  const res = await axios.get(url, { params: { forward_fg: 1, branch } });
  return res.data;
}

(async () => {
  try {
    const { date, branch, room } = parseArgs();
    console.log(`Querying branch "${branch}" for ${date} ...`);

    const raw = await fetchSchedulerJson(branch);
    const events = normalizeSchedulerPayload(raw);
    const dayEvents = filterByDate(events, date);

    if (dayEvents.length === 0) {
      console.log('No events found for the given date (maybe closed or no data).');
      process.exit(0);
    }

    const filtered = room
      ? dayEvents.filter(e =>
          [e.room, e.text].some(x => String(x).toLowerCase().includes(room.toLowerCase()))
        )
      : dayEvents;

    const grouped = groupByRoom(filtered);
    if (grouped.size === 0) {
      console.log(`No matching rooms for keyword "${room}".`);
      process.exit(0);
    }

    console.log(`\n=== ${branch} — ${date} ===`);
    for (const [rm, evs] of grouped.entries()) {
      console.log(formatRoomTimeline(rm, evs, date));
      console.log('');
    }
  } catch (err) {
    console.error('[status] failed:', err?.response?.status, err?.response?.statusText, err?.message);
  }
})();
