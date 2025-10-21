// bookRoom.js
// 匯入 selectors.js 並導出 bookRoom()

import 'dotenv/config';
import { launchBrowser, createContext, createPage } from '../services/playwright/browser.js';
import { selectBranchAndRoom, fillBookingForm, handleCaptchaAndSubmit } from '../services/playwright/selectors.js';

export async function bookRoom({
  branch,
  roomKeyword,
  date,
  start,
  end,
  people,
  username,
  password,
  show = false,
  debug = false
}) {
  const base = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw';
  const serviceBase = process.env.LIB_SERVICE_BASE || `${base}/service`;

  const browser = await launchBrowser(!show);
  const context = await createContext(browser);
  const page = await createPage(context);

  try {
    console.log(`Opening booking page for branch="${branch}", room~="${roomKeyword}"...`);
    await selectBranchAndRoom(page, serviceBase, branch, roomKeyword, debug);

    console.log('Filling form...');
    await fillBookingForm(page, { date, start, end, people }, debug);

    console.log('Handling CAPTCHA (if present) and submitting ...');
    const result = await handleCaptchaAndSubmit(page, { username, password }, debug);

    if (result.ok) {
      console.log('Done.');
      return { ok: true };
    } else {
      const code = result.code || 'booking_failed';
      const reason = result.reason || result.message || 'Unknown error';
      return { ok: false, code, message: 'Booking failed', reason };
    }
  } catch (err) {
    return { ok: false, code: 'exception', message: 'Unhandled exception', error: String(err) };
  } finally {
    // keep the browser open when --show for debugging
    if (!show) {
      await context.close();
      await browser.close();
    }
    if (global.browser) await global.browser.close().catch(() => {});
  }
}
