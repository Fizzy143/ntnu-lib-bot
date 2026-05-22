import 'dotenv/config';
import axios from 'axios';
import {
  normalizeSchedulerPayload,
  filterByDate,
  groupByRoom,
  buildAvailabilityResponse
} from '../cli/utils.js';

const BASE = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw';

export async function fetchSchedulerJson(branch) {
  const url = `${BASE}/roombooking/booksearch.booklst.jsp`;
  console.log(`[availability] GET ${url} branch="${branch}"`);
  const response = await axios.get(url, { params: { forward_fg: 1, branch } });
  return response.data;
}

export async function checkAvailability({ date, branch, room }) {
  try {
    console.log(`Querying branch "${branch}" for ${date} ...`);

    const raw = await fetchSchedulerJson(branch);
    const events = normalizeSchedulerPayload(raw);
    const dayEvents = filterByDate(events, date);
    const knownRooms = groupByRoom(events);
    const bookedRooms = groupByRoom(dayEvents);
    const grouped = buildRoomOverview({ knownRooms, bookedRooms, room });

    if (grouped.size === 0) {
      return {
        ok: true,
        branch,
        date,
        roomCount: 0,
        rooms: [],
        results: [],
        message: 'No matching rooms'
      };
    }

    const availability = buildAvailabilityResponse({ branch, date, grouped });
    return {
      ok: true,
      ...availability,
      results: availability.rooms
    };
  } catch (error) {
    console.error('[status] failed:', error?.response?.status, error?.response?.statusText, error?.message);
    return { ok: false, error: error.message };
  }
}

function buildRoomOverview({ knownRooms, bookedRooms, room }) {
  const overview = new Map();
  const keyword = String(room || '').toLowerCase();

  for (const knownRoom of knownRooms.keys()) {
    if (keyword && !knownRoom.toLowerCase().includes(keyword)) {
      continue;
    }

    overview.set(knownRoom, bookedRooms.get(knownRoom) || []);
  }

  return overview;
}
