// bookRoom.js (modified)
import 'dotenv/config';
import { launchBrowser, createContext, createPage } from '../services/playwright/browser.js';
import { selectBranchAndRoom, fillBookingForm, handleCaptchaAndSubmit } from '../services/playwright/selectors.js';

// Replace single activeBooking with a Map keyed by username (or session id)
const activeBookings = new Map();

export async function bookRoom({ branch, roomKeyword, date, start, end, people, username, password, captchaCode, show = false, debug = false }) {
  const base = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw';
  const serviceBase = process.env.LIB_SERVICE_BASE || `${base}/service`;

  let browser, context, page;

  // If second stage (captcha) and we have a saved session for this username, reuse it
  if (captchaCode && username && activeBookings.has(username)) {
    ({ browser, context, page } = activeBookings.get(username));
    console.log('[debug] Reusing existing browser session for CAPTCHA input (user:', username, ')');

    // sanity check that the form/captcha input exists
    const stillOnForm = await page.locator('input[name="response"], input[name*="captcha"]').first().count();
    if (!stillOnForm) {
      // cleanup session if the form is gone
      try { await context.close(); await browser.close(); } catch(e) {}
      activeBookings.delete(username);
      return { ok: false, code: 'exception', message: 'Booking form no longer available (captcha/form vanished)' };
    }
  } else {
    // fresh booking attempt: create new browser session
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
      // save session keyed by username so retry uses the correct browser/page
      if (username) {
        activeBookings.set(username, { browser, context, page });
      } else {
        // fallback: keep a single session in map under special key
        activeBookings.set('__default__', { browser, context, page });
      }
      // return pendingParams so caller can re-invoke with captchaCode
      return { ...result, pendingParams: { branch, roomKeyword, date, start, end, people } };
    }

    // Completed (ok or fail) -> close and cleanup session
    if (result.ok) console.log('✅ Done.');
    try { await context.close(); await browser.close(); } catch(e) {}
    if (username) activeBookings.delete(username); else activeBookings.delete('__default__');

    return result;

  } catch (err) {
    console.error('[exception in bookRoom]', err);
    // cleanup on exception
    try { if (context) await context.close(); if (browser) await browser.close(); } catch(e) {}
    if (username) activeBookings.delete(username); else activeBookings.delete('__default__');

    return { 
      ok: false, 
      code: 'exception', 
      message: err?.message || 'Unhandled exception', 
      error: err?.stack || String(err) 
    };
  }
}
