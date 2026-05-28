import 'dotenv/config';
import { launchBrowser, createContext, createPage } from '../services/playwright/browser.js';
import { selectBranchAndRoom, fillBookingForm, handleCaptchaAndSubmit } from '../services/playwright/selectors.js';
import { deleteSession, getSession, saveSession } from '../server/sessionStore.js';

export async function bookRoom({
  branch,
  roomKeyword,
  date,
  start,
  end,
  people,
  username,
  password,
  captchaCode,
  sessionKey,
  show = false,
  debug = false,
  manualCaptchaFallback = false
}) {
  const base = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw';
  const serviceBase = process.env.LIB_SERVICE_BASE || `${base}/service`;

  let browser;
  let context;
  let page;
  const bookingKey = sessionKey || username || '__default__';

  if (captchaCode) {
    const savedSession = getSession(bookingKey);
    if (savedSession) {
      ({ browser, context, page } = savedSession);
      username ||= savedSession.username;
      password ||= savedSession.password;
      console.log('[debug] Reusing existing browser session for CAPTCHA input (key:', bookingKey, ')');
    }
  }

  if (page) {
    const stillOnForm = await page.locator('input[name="response"], input[name*="captcha"]').first().count();
    if (!stillOnForm) {
      try { await context.close(); await browser.close(); } catch (error) {}
      deleteSession(bookingKey);
      return { ok: false, code: 'exception', message: 'Booking form no longer available (captcha/form vanished)' };
    }
  } else if (captchaCode) {
    return { ok: false, code: 'session_expired', message: 'Booking session expired before CAPTCHA submission' };
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
    const result = await handleCaptchaAndSubmit(page, {
      username,
      password,
      captchaCode,
      manualCaptchaFallback
    }, debug);

    if (result.code === 'captcha_needed') {
      saveSession(bookingKey, { browser, context, page, captchaPath: result.captchaPath, username, password });
      return {
        ...result,
        pendingParams: { branch, roomKeyword, date, start, end, people },
        sessionKey: bookingKey
      };
    }

    if (result.ok) {
      console.log('Done.');
    }

    try { await context.close(); await browser.close(); } catch (error) {}
    deleteSession(bookingKey);

    return result;
  } catch (error) {
    console.error('[exception in bookRoom]', error);
    try { if (context) await context.close(); if (browser) await browser.close(); } catch (cleanupError) {}
    deleteSession(bookingKey);

    return {
      ok: false,
      code: 'exception',
      message: error?.message || 'Unhandled exception',
      error: error?.stack || String(error)
    };
  }
}
