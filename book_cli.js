// book_cli.js
// Usage example:
//   node book_cli.js --branch 總館 --room 403 --date 2025-10-25 --start 18:30 --end 20:30 --people 4 --show
//
// Notes:
// - This is an MVP that navigates: select branch/room on facility_03.jsp -> click "我要預約" -> fill form -> pause for CAPTCHA -> submit.
// - Selectors for the booking form may vary; we use getByLabel with Chinese labels first, then fallback CSS.
// - No CAPTCHA solving: we screenshot the image, ask the user to type it in the console, then continue.

import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// -------------------------
// Helpers
// -------------------------
function fatal(code, message, extra={}) {
  console.error(JSON.stringify({ ok:false, code, message, ...extra }, null, 2));
  process.exit(1);
}

function assert(cond, code, msg) { if (!cond) fatal(code, msg); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, def='') => {
    const i = args.findIndex(a => a===`--${k}` || a===`-${k[0]}`);
    return i>=0 ? (args[i+1] ?? def) : def;
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

function to24h(t) { return t.includes(':') ? t : `${t}:00`; }

async function selectBranchAndRoom(page, serviceBase, branch, roomKeyword, debug=false) {
  const startUrl = `${serviceBase}/facility_03.jsp`;
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

  // 1) Branch radio
  // input[name="place"][value="總館|公館分館|林口分館"]
  await page.waitForSelector('input[name="place"]', { timeout: 15000 });
  const branchRadio = page.locator(`input[name="place"][value="${branch}"]`);
  assert(await branchRadio.count() > 0, 'branch_not_found', `Branch radio not found for "${branch}"`);
  await branchRadio.check();

  // 2) Room select
  // select[name="room"] options show visible text like "401團討室 Room 401(3-6人)" etc.
  await page.waitForSelector('select[name="room"]', { timeout: 15000 });
  const select = page.locator('select[name="room"]');

  // Try to match by label text (contains roomKeyword); fallback: first option after branch switch
  const options = await select.locator('option').allTextContents();
  let matchedLabel = '';
  if (roomKeyword) {
    const idx = options.findIndex(t => t.toLowerCase().includes(roomKeyword.toLowerCase()));
    assert(idx >= 0, 'room_not_found', `Room option not found by keyword "${roomKeyword}"`, { options: options.slice(0, 10) });
    matchedLabel = options[idx];
    await select.selectOption({ label: matchedLabel });
  } else {
    // select first room if none provided
    matchedLabel = options[1] || options[0] || '';
    assert(matchedLabel, 'room_list_empty', 'No room options found');
    await select.selectOption({ label: matchedLabel });
  }

  if (debug) {
    console.log('[debug] matched room label:', matchedLabel);
  }

  // 3) Click "我要預約"
  // <input type="submit" value="我要預約">
  const reserveBtn = page.locator('input[type="submit"][value="我要預約"]');
  assert(await reserveBtn.count() > 0, 'reserve_button_missing', 'Cannot find "我要預約" button');
  await reserveBtn.click();

  // After click, a booking page should load.
  await page.waitForLoadState('domcontentloaded');
  await sleep(500);
}

async function fillBookingForm(page, { date, start, end, people }, debug=false) {
    let ok = false;
  // Try to fill by visible labels first
  const safeFillByLabel = async (labelRegex, value) => {
    try {
      const ctrl = page.getByLabel(labelRegex, { exact: false }).first();
      if (await ctrl.count() > 0) {
        await ctrl.fill(value);
        return true;
      }
    } catch (_) {}
    return false;
  };

  const tryFill = async (selectors, value) => {
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.fill(value);
        return true;
      }
    }
    return false;
  };

  // Date
  try {
  // locate the calendar icon (usually next to input)
  const dateTrigger = page.locator('img[onclick*="calendar"], img[title*="日期"], img[src*="calendar"], button[onclick*="calendar"]').first();
  if (await dateTrigger.count() > 0) {
    await dateTrigger.click({ force: true });
    await page.waitForTimeout(500);

    // Try to open month of target date
    const target = new Date(date);
    const day = target.getDate();

    // Click the day button in the calendar popup
    const dayBtn = page.locator(`//td[normalize-space(text())='${day}']`).first();
    await dayBtn.click({ force: true });

    console.log(`[debug] Selected date ${date} via calendar.`);
  } else {
    // fallback: directly remove readonly and fill
    const dateInput = page.locator('input[name="revdate"], #date1').first();
    if (await dateInput.count() > 0) {
      await page.evaluate(el => el.removeAttribute('readonly'), await dateInput.elementHandle());
      await dateInput.fill(date);
      console.log(`[debug] Filled date ${date} by removing readonly.`);
    } else {
      console.warn('⚠️ No date picker or input found for date field.');
    }
  }
  } catch (e) {
    console.error('⚠️ Date picker handling failed:', e);
  }

  // People
  ok = await safeFillByLabel(/人數|People|人/ , String(people));
  if (!ok) ok = await tryFill(['input[name*="people"]','input[id*="people"]','input[name*="num"]','input[name="user_count"]'], String(people));
  assert(ok, 'field_people_missing', 'Cannot find "人數" field');

  // --- Usage description ---
  let usageValue = '討論'; // 先定義在外層，避免作用域問題
  ok = false;
  try {
    // 若有傳入 --usage 則覆蓋
    if (process.argv.includes('--usage')) {
      const idx = process.argv.indexOf('--usage');
      if (idx >= 0 && process.argv[idx + 1]) {
        usageValue = process.argv[idx + 1];
      }
    }

    const usageInput = page.locator('input[name="usage"], input[id*="usage"]').first();
    if (await usageInput.count() > 0) {
      await usageInput.fill(usageValue);
      ok = true;
    }
  } catch (err) {
    console.error('⚠️ Cannot fill usage field:', err.message);
  }
  if (ok) console.log(`[debug] Filled usage=${usageValue}`);


  // --- Start time ---
  ok = false;
  try {
  // 嘗試填入 select
  const startSelect = page.locator('select[name*="start"], select[id*="start"], select[name*="stime"]').first();
  if (await startSelect.count() > 0) {
    await startSelect.selectOption({ value: to24h(start) }).catch(async () => {
      // 若 value 不符，改找 label 文字
      const opts = await startSelect.locator('option').allTextContents();
      const match = opts.find(o => o.includes(start));
      if (match) await startSelect.selectOption({ label: match });
    });
    ok = true;
  } else {
    // fallback to input
    ok = await safeFillByLabel(/開始|Start/i, to24h(start));
    if (!ok) ok = await tryFill(['input[name*="start"]','input[id*="start"]'], to24h(start));
  }
} catch (err) {
  console.error('⚠️ Error selecting start time:', err.message);
}
assert(ok, 'field_start_missing', 'Cannot find "開始時間" field');
if (debug) console.log(`[debug] Filled start=${start}`);


// --- End time ---
ok = false;
try {
  const endSelect = page.locator('select[name*="end"], select[id*="end"], select[name*="etime"]').first();
  if (await endSelect.count() > 0) {
    await endSelect.selectOption({ value: to24h(end) }).catch(async () => {
      const opts = await endSelect.locator('option').allTextContents();
      const match = opts.find(o => o.includes(end));
      if (match) await endSelect.selectOption({ label: match });
    });
    ok = true;
  } else {
    ok = await safeFillByLabel(/結束|End/i, to24h(end));
    if (!ok) ok = await tryFill(['input[name*="end"]','input[id*="end"]'], to24h(end));
  }
} catch (err) {
  console.error('⚠️ Error selecting end time:', err.message);
}
assert(ok, 'field_end_missing', 'Cannot find "結束時間" field');
if (debug) console.log(`[debug] Filled end=${end}`);


  // Agree checkbox
  const agree = page.getByRole('checkbox', { name: /已閱讀|同意|使用規則|terms/i }).first();
  if (await agree.count() > 0) {
    await agree.check().catch(()=>{});
  } else {
    // Try generic selectors
    const cands = ['#agree', 'input[name*="agree"]', 'input[name*="terms"]', 'input[name="comfirm"]'];
    for (const sel of cands) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) { await el.check().catch(()=>{}); break; }
    }
  }

  if (debug) console.log('[debug] filled date/time/people and agree checkbox (if any)');
}

async function handleCaptchaAndSubmit(page, { username, password }, debug=false) {
  // Try to locate a captcha image
  const img = page.locator('img#captcha, img#captchaImg, img.captcha, img[src*="captcha"]').first();
  const hasImg = await img.count() > 0;

  let code = '';
  if (hasImg) {
    // Save screenshot to file
    const out = path.join(process.cwd(), 'captcha.png');
    await img.screenshot({ path: out });
    console.log(`\nCAPTCHA saved to: ${out}`);
    process.stdout.write('Enter CAPTCHA code > ');
    code = await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', d => resolve(String(d).trim()));
    });
    process.stdin.pause();

    // Fill captcha input
    let ok = false;
    const candidates = [
      page.getByLabel(/驗證碼|Captcha/i).first(),
      page.locator('input[name*="captcha"]').first(),
      page.locator('input[id*="captcha"]').first(),
      page.locator('input[name="response"]').first()
    ];
    for (const c of candidates) {
      if (await c.count() > 0) { await c.fill(code); ok = true; break; }
    }
    assert(ok, 'captcha_input_missing', 'Cannot find "驗證碼" input box');
  } else {
    if (debug) console.log('[debug] no captcha image found on this page');
  }

  // Optional: Fill credentials if present
  if (username) {
    const u = page.getByLabel(/帳號|學號|User/i).first().or(page.locator('input[name*="userName"],input[id*="user"]'));
    if (await u.count() > 0) await u.fill(username);
  }
  if (password) {
    const p = page.getByLabel(/密碼|Password/i).first().or(page.locator('input[type="password"]'));
    if (await p.count() > 0) await p.fill(password);
  }

  // Fill CAPTCHA and credentials ...
  // --- Listen for alert dialogs (錯誤彈窗處理) ---
  let dialogMessage = '';
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message();
    console.log(`[alert] ${dialogMessage}`);
    await dialog.dismiss().catch(()=>{});
  });

  // Submit
  const submit = page.getByRole('button', { name: /(確認|送出|提交|預約)/ }).first()
    .or(page.locator('input[type="submit"][value*="確認"]'))
    .or(page.locator('input[type="submit"][value*="送出"]'))
    .or(page.locator('input[type="submit"][value*="預約"]'));
  if (await submit.count() > 0) {
    await submit.click();
  } else {
    fatal('submit_button_missing', 'Cannot find submit button');
  }

  // Wait result
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await sleep(1200);

  if (dialogMessage) {
    let codeType = 'unknown_error';
    if (/驗證碼/i.test(dialogMessage)) codeType = 'captcha_error';
    if (/帳號|密碼/i.test(dialogMessage)) codeType = 'auth_error';
    if (/額滿|無法預約|滿額/i.test(dialogMessage)) codeType = 'slot_full';
    return {
      ok: false,
      code: codeType,
      message: dialogMessage,
      reason: dialogMessage
    };
  }

  // Check success or error message
  const success = await page.locator('text=預約成功').first().isVisible().catch(()=>false);
  if (success) {
    console.log('✅ Booking success!');
    return { ok: true };
  }

  // Try to extract error message
  let errText = '';
  const possibleErrorSelectors = ['.error', '.alert', '.msg', '.message', '#content', '.main'];
  for (const sel of possibleErrorSelectors) {
    const elem = page.locator(sel).first();
    if (await elem.count() > 0) {
      errText = (await elem.textContent())?.trim() || '';
      if (errText.length > 10) break;
    }
  }
  errText = (errText || '').replace(/\s+/g, ' ').trim();
  if (!errText) errText = '未知錯誤（可能是帳號密碼錯誤、驗證碼錯誤或時段已滿）';

  let codeType = 'unknown_error';
  if (/驗證碼/i.test(errText)) codeType = 'captcha_error';
  if (/帳號|密碼/i.test(errText)) codeType = 'auth_error';
  if (/額滿|無法預約|滿額/i.test(errText)) codeType = 'slot_full';
  
  return { ok: false, code: codeType, message: 'Booking failed', reason: errText };
}

(async () => {
  const {
    branch, roomKeyword, date, start, end, people, show, debug
  } = parseArgs();

  const base = process.env.LIB_BASE || 'https://www.lib.ntnu.edu.tw';
  const serviceBase = process.env.LIB_SERVICE_BASE || `${base}/service`;
  const username = process.env.USERNAME || '';
  const password = process.env.PASSWORD || '';

  // Parameter validation
  assert(branch, 'arg_branch_required', 'Missing --branch (e.g., 總館/公館分館/林口分館)');
  assert(date && start && end && people, 'arg_missing', 'Missing required args: --date --start --end --people');

  const browser = await chromium.launch({ headless: !show });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`Opening booking page for branch="${branch}", room~="${roomKeyword}"...`);
    await selectBranchAndRoom(page, serviceBase, branch, roomKeyword, debug);

    console.log('Filling form...');
    await fillBookingForm(page, { date, start, end, people }, debug);

    console.log('Handling CAPTCHA (if present) and submitting ...');
    const result = await handleCaptchaAndSubmit(page, { username, password }, debug);

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
  } finally {
    // keep the browser open when --show for debugging
    if (!show) {
      await context.close();
      await browser.close();
    }
    if (global.browser) await global.browser.close().catch(()=>{});
  }
})();
