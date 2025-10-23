// selectors.js
// 放 selectBranchAndRoom, fillBookingForm, handleCaptchaAndSubmit

// selectors.js 或相同 module 中
/**
 * Try to read the minimum allowed people count from the page related to the people input.
 * - peopleSelector: selector for the people input (default 'input[name="user_count"]')
 * - debug: if true save console logs
 * returns integer or null
 */
export async function getMinPeopleFromPage(page, peopleSelector = 'input[name="user_count"]', debug = false) {
  return await page.evaluate(({ peopleSelector }) => {
    function extractNumberFromText(text) {
      if (!text) return null;
      // common patterns:
      // "最少人數 2", "最少人數: 2", "at least: 2", "至少 2 人"
      const patterns = [
        /最少(?:人數|人).*?(\d{1,3})/u,
        /至少\s*(\d{1,3})/u,
        /at\s*least[:\s]*?(\d{1,3})/i,
        /minimum[:\s]*?(\d{1,3})/i,
        /(\d{1,3})\s*人(?:起|以上|以上可借)?/u
      ];
      for (const r of patterns) {
        const m = text.match(r);
        if (m && m[1]) return parseInt(m[1], 10);
      }
      return null;
    }

    const el = document.querySelector(peopleSelector);
    if (!el) return null;

    // 1) check text nodes immediately after input
    let node = el.nextSibling;
    if (node) {
      // nextSibling might be text node or element
      let text = (node.nodeType === Node.TEXT_NODE) ? node.textContent : node.textContent;
      const n = extractNumberFromText(text);
      if (n) return n;
    }

    // 2) check parent element text (trim input text itself)
    const parentText = el.parentElement ? el.parentElement.textContent : null;
    if (parentText) {
      const n = extractNumberFromText(parentText);
      if (n) return n;
    }

    // 3) search for following sibling spans/divs (common markup: <span class="hint">最少人數: 2</span>)
    const candidate = el.parentElement ? el.parentElement.querySelector('span,div,small,label') : null;
    if (candidate) {
      const n = extractNumberFromText(candidate.textContent);
      if (n) return n;
    }

    // 4) fallback: search whole document for phrases near "最少" + number
    const bodyText = document.body.textContent || '';
    const nearMatch = extractNumberFromText(bodyText);
    if (nearMatch) return nearMatch;

    return null;
  }, { peopleSelector });
}

//import { getMinPeopleFromPage } from './selectors.js';
import path from 'path';

function assert(cond, code, msg) {
  if (!cond) {
    console.error(JSON.stringify({ ok: false, code, message: msg }, null, 2));
    throw new Error(`[${code}] ${msg}`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function to24h(t) {
  return t.includes(':') ? t : `${t}:00`;
}

export async function selectBranchAndRoom(page, serviceBase, branch, roomKeyword, debug = false) {
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

export async function fillBookingForm(page, { date, start, end, people }, debug = false) {
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
      // The date cells have class like "ng_cal_date_M_D_Y" and id like "date_ng_calendar_xxx_M_D_Y"
      // Try multiple selectors to ensure we can click the correct day
      const [month, dayNum, year] = [target.getMonth() + 1, day, target.getFullYear()];
      
      const daySelectors = [
        `td[id*="date_ng_calendar"][id$="_${month}_${dayNum}_${year}"]`,
        `td.ng_cal_selectable:has-text("${day}")`,
        `td[rel="${month}/${dayNum}/${year}"]`,
        `//td[contains(@class, 'ng_cal_date') and normalize-space(text())='${day}']`
      ];
      
      let clicked = false;
      for (const selector of daySelectors) {
        const dayBtn = page.locator(selector).first();
        if (await dayBtn.count() > 0) {
          await dayBtn.click({ force: true });
          clicked = true;
          break;
        }
      }
      
      if (!clicked) {
        console.warn(`⚠️ Could not find day button for ${date}, trying fallback`);
        // Fallback: just click any td with the day number
        const fallbackBtn = page.locator(`td:has-text("${day}")`).first();
        if (await fallbackBtn.count() > 0) {
          await fallbackBtn.click({ force: true });
        }
      }

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
  /*
  ok = await safeFillByLabel(/人數|People|人/, String(people));
  if (!ok) ok = await tryFill(['input[name*="people"]', 'input[id*="people"]', 'input[name*="num"]', 'input[name="user_count"]'], String(people));
  assert(ok, 'field_people_missing', 'Cannot find "人數" field');
  */
  let minPeople = null;
  try {
    minPeople = await getMinPeopleFromPage(page, 'input[name="user_count"]', debug);
    if (debug) console.log('[fillBookingForm] detected minPeople from page:', minPeople);
  } catch (e) {
    if (debug) console.warn('[fillBookingForm] getMinPeopleFromPage failed', e);
  }

  // decide which people value to use:
  // if user provided people -> ensure at least minPeople
  // if user didn't -> use minPeople if available else fallback to 1
  let peopleToSet = people;
  if (!peopleToSet) {
    peopleToSet = minPeople || 1;
  } else if (minPeople && Number(peopleToSet) < Number(minPeople)) {
    // enforce min
    if (debug) console.log(`[fillBookingForm] user-provided people (${peopleToSet}) < minPeople (${minPeople}), overriding.`);
    peopleToSet = minPeople;
  }

  // now set the people input robustly (focus, set value, dispatch events)
  try {
    await page.evaluate(({ selector, val }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.focus && el.focus();
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur && el.blur();
      return true;
    }, { selector: 'input[name="user_count"]', val: peopleToSet });
    if (debug) console.log('[fillBookingForm] set people to', peopleToSet);
  } catch (e) {
    if (debug) console.warn('[fillBookingForm] setting people failed', e);
  }

  // optionally verify the value readback
  try {
    const read = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.value : null;
    }, 'input[name="user_count"]');
    if (debug) console.log('[fillBookingForm] readback people value:', read);
  } catch (e) { if (debug) console.warn('readback failed', e); }

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
      if (!ok) ok = await tryFill(['input[name*="start"]', 'input[id*="start"]'], to24h(start));
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
      if (!ok) ok = await tryFill(['input[name*="end"]', 'input[id*="end"]'], to24h(end));
    }
  } catch (err) {
    console.error('⚠️ Error selecting end time:', err.message);
  }
  assert(ok, 'field_end_missing', 'Cannot find "結束時間" field');
  if (debug) console.log(`[debug] Filled end=${end}`);

  // Agree checkbox
  const agree = page.getByRole('checkbox', { name: /已閱讀|同意|使用規則|terms/i }).first();
  if (await agree.count() > 0) {
    await agree.check().catch(() => {});
  } else {
    // Try generic selectors
    const cands = ['#agree', 'input[name*="agree"]', 'input[name*="terms"]', 'input[name="comfirm"]'];
    for (const sel of cands) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.check().catch(() => {});
        break;
      }
    }
  }

  if (debug) console.log('[debug] filled date/time/people and agree checkbox (if any)');
}

import { solveCaptcha } from './captchaSolver.js';

export async function handleCaptchaAndSubmit(page, { username, password, captchaCode, pendingParams }, debug = false) {
  const img = page.locator('img#captcha, img#captchaImg, img.captcha, img[src*="captcha"]').first();
  const hasImg = await img.count() > 0;

  let code = captchaCode || '';
  let out = '';

    console.log('[debug] handleCaptchaAndSubmit start - captchaCode:', captchaCode);

  // ① 若有 CAPTCHA 但未提供代碼 → 截圖並回傳
  if (hasImg && !captchaCode) {
    out = path.join(process.cwd(), 'captcha.png');
    await img.screenshot({ path: out });
    console.log(`[CAPTCHA] Saved to: ${out}`);

    // If auto-solve enabled, try Python solver before asking user
    const autoSolve = process.env.AUTO_SOLVE_CAPTCHA === 'true';
    if (autoSolve) {
    try {
      console.log('[CAPTCHA] AUTO_SOLVE_CAPTCHA enabled — calling python solver...');
      // you can customize timeout here
      const solved = await solveCaptcha(out, { timeout: Number(process.env.CAPTCHA_SOLVER_TIMEOUT || 10000) });
      if (solved && String(solved).length > 0) {
        console.log('[CAPTCHA] solver returned:', solved);
        // assign captchaCode so later filling logic uses it
        captchaCode = String(solved).trim();
        // continue function — do NOT return captcha_needed
        code = captchaCode;
      } else {
        console.warn('[CAPTCHA] solver returned empty result, falling back to manual flow');
        if (process.env.DISCORD_MODE === 'true') {
          return { ok: false, code: 'captcha_needed', captchaPath: out, pendingParams: { username, password, ...pendingParams } };
        }
        // else CLI: you can still prompt below or return
      }
    } catch (e) {
      console.error('[CAPTCHA] solver error:', e.message);
      // fallback to manual input
    }}

    // 在 Discord 模式下，直接回傳圖片路徑，不等待輸入
    if (process.env.DISCORD_MODE === 'true' && !captchaCode) {
      return {
        ok: false,
        code: 'captcha_needed',
        captchaPath: out,
        pendingParams: { username, password, ...pendingParams }
      };
    }

    if (!captchaCode) {
    // CLI 模式 → 手動輸入
    process.stdout.write('Enter CAPTCHA code > ');
    code = await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', d => resolve(String(d).trim()));
    });
    process.stdin.pause();
    }
  }

  // ② 若已提供 captchaCode 或自動解碼成功 → 填入並提交
  if (captchaCode) {
    console.log(`[CAPTCHA] Using code: ${captchaCode}`);
  }

  // 填入驗證碼
  if (hasImg || captchaCode) {
    console.log('[debug] handleCaptchaAndSubmit submitting - captchaCode:', captchaCode);
    let ok = false;
    const candidates = [
      page.getByLabel(/驗證碼|Captcha/i).first(),
      page.locator('input[name*="captcha"]').first(),
      page.locator('input[id*="captcha"]').first(),
      page.locator('input[name="response"]').first()
    ];
    for (const c of candidates) {
      if (await c.count() > 0) {
        await c.fill(code);
        ok = true;
        break;
      }
    }
    assert(ok, 'captcha_input_missing', 'Cannot find "驗證碼" input box');
  } else if (debug) {
    console.log('[debug] no captcha image found on this page');
  }

  // 帳密填入
  if (username) {
    console.log('[debug] handleCaptchaAndSubmit start - username:', username);
    const u = page.getByLabel(/帳號|學號|User/i).first().or(page.locator('input[name*="userName"],input[id*="user"]'));
    if (await u.count() > 0) await u.fill(username);
  }
  if (password) {
    console.log('[debug] handleCaptchaAndSubmit start - password: ', password);
    const p = page.getByLabel(/密碼|Password/i).first().or(page.locator('input[type="password"]'));
    if (await p.count() > 0) await p.fill(password);
  }

  // 監聽 alert（同時判斷是否為「預約成功」）
  let dialogMessage = '';
  let dialogSuccess = false;
  let dialogSuccessInfo = null;

  page.once('dialog', async dialog => {
    const msg = dialog.message() || '';
    console.log(`[alert] ${msg}`);

    // 判斷是否為成功訊息（例：預約結果:2025-10-28 13:00/15:00--成功!）
    const successPattern = /預約結果[:：]?.*?(成功!?)/u;
    const isSuccess = successPattern.test(msg) || (/成功/.test(msg) && /預約/.test(msg));

    if (isSuccess) {
      dialogSuccess = true;
      dialogSuccessInfo = msg;
      // 避免後續 if (dialogMessage) 被當作錯誤分支觸發
      dialogMessage = '';
    } else {
      dialogMessage = msg;
    }

    await dialog.dismiss().catch(() => {});
  });

  // 送出表單
  const submit = page.getByRole('button', { name: /(確認|送出|提交|預約)/ }).first()
    .or(page.locator('input[type="submit"][value*="確認"]'))
    .or(page.locator('input[type="submit"][value*="送出"]'))
    .or(page.locator('input[type="submit"][value*="預約"]'));

  if (await submit.count() > 0) {
    await submit.click();
  } else {
    throw new Error('submit_button_missing');
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(1200);

  if (dialogMessage) {
    let codeType = 'unknown_error';
    if (/驗證碼/i.test(dialogMessage)) codeType = 'captcha_error';
    if (/帳號|密碼/i.test(dialogMessage)) codeType = 'auth_error';
    if (/額滿|無法預約|滿額/i.test(dialogMessage)) codeType = 'slot_full';
    return { ok: false, code: codeType, message: dialogMessage, reason: dialogMessage };
  }

  // 成功訊息檢查
  if (dialogSuccess) {
    console.log('✅ Booking success! (via alert)');
    return { ok: true };
  }

  // 頁面內成功訊息檢查
  const successMessage = await page.locator('text=預約結果').first().textContent().catch(() => '');
  if (successMessage.includes('成功')) {
    console.log('✅ Booking success!');
    return { ok: true };
  }

  // 錯誤文字分析
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

