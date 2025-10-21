// bookRoom.js
// 匯入 selectors.js 並導出 bookRoom()

import 'dotenv/config';
import { launchBrowser, createContext, createPage } from '../services/playwright/browser.js';
import { selectBranchAndRoom, fillBookingForm, handleCaptchaAndSubmit } from '../services/playwright/selectors.js';

// bookRoom.js
let activeBooking = null;

export async function bookRoom({ branch, roomKeyword, date, start, end, people, username, password, captchaCode, show = false, debug = false }) {
  const base = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw';
  const serviceBase = process.env.LIB_SERVICE_BASE || `${base}/service`;

  let browser, context, page;

  // 如果是第二階段（輸入 captcha），就重用前次的 session
  if (captchaCode && activeBooking) {
    ({ browser, context, page } = activeBooking);
    console.log('[debug] Reusing existing browser session for CAPTCHA input');

    const stillOnForm = await page.locator('input[name="response"], input[name*="captcha"]').first().count();
    if (!stillOnForm) {
        // 若真的不在表單頁，就只能回報錯誤（或整段重跑，但不建議）
        return { ok: false, code: 'exception', message: 'Booking form no longer available (captcha/form vanished)' };
    }
  } else {
    browser = await launchBrowser(!show);
    context = await createContext(browser);
    page = await createPage(context);
  }

  try {
    if (!captchaCode) {
      console.log(`Opening booking page for branch="${branch}", room~="${roomKeyword}"...`);
      await selectBranchAndRoom(page, serviceBase, branch, roomKeyword, debug);
      console.log('Filling form...');
      await fillBookingForm(page, { date, start, end, people }, debug);
    }

    console.log('Handling CAPTCHA (if present) and submitting ...');
    const result = await handleCaptchaAndSubmit(page, { username, password, captchaCode }, debug);

    if (result.code === 'captcha_needed') {
      // 記錄目前 session
      activeBooking = { browser, context, page };
      return { ...result, pendingParams: { branch, roomKeyword, date, start, end, people } };
    }

    // 成功或失敗 → 關閉瀏覽器並清除 session
    if (result.ok) console.log('✅ Done.');
    await context.close();
    await browser.close();
    activeBooking = null;

    return result;

  } catch (err) {
    console.error('[exception in bookRoom]', err);
    return { 
        ok: false, 
        code: 'exception', 
        message: err?.message || 'Unhandled exception', 
        error: err?.stack || String(err) 
    };
}
}
