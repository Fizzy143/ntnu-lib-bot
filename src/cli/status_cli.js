import 'dotenv/config';
import dayjs from 'dayjs';
import { checkAvailability } from '../usecases/checkAvailability.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, def = '') => {
    const i = args.findIndex(a => a === `--${k}` || a === `-${k[0]}`);
    if (i >= 0) return args[i + 1] ?? def;
    return def;
  };
  const date = get('date') || dayjs().format('YYYY-MM-DD');
  const branch = get('branch') || process.env.DEFAULT_BRANCH || '總館';
  const room = get('room') || '';
  return { date, branch, room };
}

(async () => {
  try {
    const { date, branch, room } = parseArgs();
    await checkAvailability({ date, branch, room });
  } catch (err) {
    console.error('[status] failed:', err?.message);
  }
})();
