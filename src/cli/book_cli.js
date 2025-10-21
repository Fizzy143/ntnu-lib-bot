// book_cli.js
// Usage example:
//   node book_cli.js --branch 總館 --room 403 --date 2025-10-25 --start 18:30 --end 20:30 --people 4 --show
//
// Notes:
// - This is an MVP that navigates: select branch/room on facility_03.jsp -> click "我要預約" -> fill form -> pause for CAPTCHA -> submit.
// - Selectors for the booking form may vary; we use getByLabel with Chinese labels first, then fallback CSS.
// - No CAPTCHA solving: we screenshot the image, ask the user to type it in the console, then continue.

import 'dotenv/config';
import { bookRoom } from '../usecases/bookRoom.js';

// -------------------------
// Helpers
// -------------------------
function fatal(code, message, extra = {}) {
  console.error(JSON.stringify({ ok: false, code, message, ...extra }, null, 2));
  process.exit(1);
}

function assert(cond, code, msg) {
  if (!cond) fatal(code, msg);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, def = '') => {
    const i = args.findIndex(a => a === `--${k}` || a === `-${k[0]}`);
    return i >= 0 ? (args[i + 1] ?? def) : def;
  };
  const has = (k) => args.some(a => a === `--${k}` || a === `-${k[0]}`);
  return {
    branch: get('branch') || process.env.DEFAULT_BRANCH || '總館',
    roomKeyword: get('room') || process.env.DEFAULT_ROOM_KEYWORD || '',
    date: get('date') || process.env.DEFAULT_DATE || '',
    start: get('start') || process.env.DEFAULT_START || '',
    end: get('end') || process.env.DEFAULT_END || '',
    people: get('people') || process.env.DEFAULT_PEOPLE || '2',
    usage: get('usage') || '討論',
    show: has('show'),     // show the browser (non-headless)
    debug: has('debug')
  };
}

(async () => {
  const {
    branch, roomKeyword, date, start, end, people, show, debug
  } = parseArgs();

  const username = process.env.USERNAME || '';
  const password = process.env.PASSWORD || '';

  // Parameter validation
  assert(branch, 'arg_branch_required', 'Missing --branch (e.g., 總館/公館分館/林口分館)');
  assert(date && start && end && people, 'arg_missing', 'Missing required args: --date --start --end --people');

  try {
    const result = await bookRoom({
      branch,
      roomKeyword,
      date,
      start,
      end,
      people,
      username,
      password,
      show,
      debug
    });

    if (result.ok) {
      console.log('Done.');
      process.exit(0);
    } else {
      const code = result.code || 'booking_failed';
      const reason = result.reason || result.message || 'Unknown error';
      fatal(code, 'Booking failed', { reason });
    }
  } catch (err) {
    fatal('exception', 'Unhandled exception', { error: String(err) });
  }
})();
