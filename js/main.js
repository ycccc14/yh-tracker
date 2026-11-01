// Start-up, navigation, pairing, the install guide and the app lock.
'use strict';

// ============================== navigation ==============================
let lastRoute = '';
let renderQueued = false;

function render() {
  renderQueued = false;
  if (!M.token || !$('#cover').hidden) return;
  const active = document.activeElement;
  const keep = active && active.id && $('#view').contains(active) ? { id: active.id, a: active.selectionStart, b: active.selectionEnd } : null;
  const changed = lastRoute !== view.route + '/' + view.arg;
  lastRoute = view.route + '/' + view.arg;
  let html;
  try {
    html = SCREENS[view.route](view.arg);
  } catch (e) {
    console.error(e);
    html = `<div class="card empty"><span class="e">😕</span>Something went wrong showing this page.<br><button class="btn" data-a="go" data-to="home">Go home</button></div>`;
  }
  $('#view').innerHTML = `<div class="${changed ? 'screen' : 'screen-still'}" style="display:grid;gap:16px">${html}</div>`;
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus(); try { el.setSelectionRange(keep.a, keep.b); } catch (e) { /* not a text field */ } }
  }
  $$('#tabs .tab').forEach((t) => t.classList.toggle('on', t.dataset.to === TAB_OF[view.route]));
  $('.tab-dot').hidden = !billsAttention().some((x) => x.days <= 0);
  updateBadge();
}

// Redraw after data changes, at most once per frame.
onChange = () => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
};

function readHash() {
  const [r, a] = decodeURIComponent(location.hash.slice(1)).split('/');
  view.route = SCREENS[r] ? r : 'home';
  view.arg = a || '';
}

function go(route, arg) {
  const h = '#' + route + (arg ? '/' + arg : '');
  if (location.hash === h) { render(); return; }
  location.replace(h);
}
window.addEventListener('hashchange', () => { readHash(); render(); window.scrollTo(0, 0); });

actions.go = (el) => {
  const to = el.dataset.to;
  if (to === 'records') Object.assign(view, { recType: 'all', recAcc: '', recCat: '', recQuery: '', month: thisMonth() });
  if (to === 'home') view.month = thisMonth();
  go(to, el.dataset.id);
};
actions.month = (el) => {
  const next = shiftMonth(view.month, Number(el.dataset.d));
  if (next > thisMonth()) return;
  view.month = next;
  render();
};
actions['cat-records'] = (el) => {
  Object.assign(view, { recType: 'all', recAcc: '', recCat: el.dataset.id, recQuery: '' });
  go('records');
};
actions['rec-type'] = (el) => { view.recType = el.dataset.v; render(); };
actions['rec-acc'] = (el) => { view.recAcc = view.recAcc === el.dataset.v ? '' : el.dataset.v; render(); };
actions['rec-cat'] = (el) => { view.recCat = el.dataset.v; render(); };
actions['rec-search'] = (el) => { view.recQuery = el.value; $('#rec-list').innerHTML = recordsList(); };
actions['cat-kind'] = (el) => { view.catKind = el.dataset.v; render(); };

// ============================== settings actions ==============================
actions['set-name'] = (el) => {
  const v = el.value.trim().slice(0, 30);
  if (v && v !== setting('name')) { put('settings', { id: 'name', value: v }); toast('Saved ✓'); }
};
actions['sync-now'] = async (el) => {
  el.disabled = true;
  await sync();
  el.disabled = false;
  toast(syncState.error || 'Backed up ✓');
};
actions['push-on'] = async (el) => {
  el.disabled = true;
  try {
    await enablePush();
    toast('Notifications on ✓');
  } catch (e) {
    toast(e.message, 4500);
  }
  el.disabled = false;
  render();
};
actions['push-test'] = async (el) => {
  el.disabled = true;
  try {
    await testPush();
    toast('Sent — it should arrive in a few seconds');
  } catch (e) {
    toast(e.message, 4500);
  }
  el.disabled = false;
};
actions.unpair = async () => {
  const waiting = unsentCount();
  const ok = await confirmSheet('Unpair this phone?', (waiting ? `${waiting} change(s) haven’t uploaded yet and will be lost. ` : '') +
    'Your Google Sheet keeps everything else. You’ll need a new pairing code to use the app again.', 'Unpair', true);
  if (!ok) return;
  try { await api('unpair'); } catch (e) { /* offline: the token is forgotten anyway */ }
  await wipeLocal();
  location.replace(location.pathname);
  location.reload();
};

function csvCell(v, text) {
  v = String(v == null ? '' : v);
  if (text && /^[=+\-@]/.test(v)) v = "'" + v; // spreadsheets would treat it as a formula
  return /[",\r\n]/.test(v) || (text && v[0] === "'") ? '"' + v.replace(/"/g, '""') + '"' : v;
}
actions.export = async () => {
  const name = (id) => (acc(id) || cat(id) || {}).name || '';
  const rows = [['Date', 'Type', 'Amount', 'Account', 'To account', 'Category', 'Note'].join(',')];
  txSorted().slice().reverse().forEach((t) => {
    rows.push([t.date, t.type, Number(t.amount).toFixed(2)].map((v) => csvCell(v)).concat(
      [name(t.accountId), name(t.toAccountId), name(t.categoryId), t.note].map((v) => csvCell(v, true))).join(','));
  });
  const file = new File(['﻿' + rows.join('\r\n')], `YH-Tracker-${today()}.csv`, { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'YH Tracker records' }); return; }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};

// ============================== full-screen covers ==============================
function cover(html) {
  const el = $('#cover');
  el.innerHTML = `<div class="center">${html}</div>`;
  el.hidden = false;
  $('#tabs').hidden = true;
  return el;
}
const appIcon = '<img class="app-icon" src="icons/icon-180.png" alt="" width="88" height="88">';

function showInstall() {
  cover(`${appIcon}<div><h1>Install YH Tracker</h1><p class="muted" style="margin-top:6px">Add it to your Home Screen so it opens like a normal app, works offline and can remind you about bills.</p></div>
    <section class="card"><ol class="steps">
      <li><span>Tap the <b>Share</b> button <span style="display:inline-block;vertical-align:-5px;color:var(--series-income)">${icon('share')}</span> at the bottom of Safari.</span></li>
      <li><span>Scroll down and tap <b>Add to Home Screen</b>.</span></li>
      <li><span>Tap <b>Add</b>, then open <b>YH Tracker</b> from your Home Screen.</span></li></ol></section>
    <p class="muted small">Not on an iPhone? <button class="link" data-a="skip-install">Continue in the browser</button></p>`);
}
actions['skip-install'] = () => showPair();

function showPair(note) {
  cover(`${appIcon}<div><h1>Welcome 👋</h1><p class="muted" style="margin-top:6px">Type the pairing code you were sent. You only do this once.</p></div>
    ${note ? `<div class="banner warn"><p>${esc(note)}</p></div>` : ''}
    <section class="card stack" style="text-align:left">
      <label class="field"><span>Pairing code</span><input class="input code-input" id="pair-code" maxlength="9" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="one-time-code" autocorrect="off" spellcheck="false"></label>
      <label class="field"><span>Name this phone</span><input class="input" id="pair-name" maxlength="40" value="YH’s iPhone"></label>
      <button class="btn primary block" data-a="pair-go">🔑 Pair this phone</button>
      <p class="small" id="pair-err" style="color:var(--bad);min-height:18px"></p>
    </section>
    <p class="muted small">🔒 Your data stays on this phone and in a private Google Sheet. Only paired phones can reach it.</p>`);
  const code = $('#pair-code');
  code.addEventListener('input', () => {
    const raw = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    code.value = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
  });
  const m = location.hash.match(/pair=([A-Za-z0-9-]+)/);
  if (m) code.value = m[1].toUpperCase();
}
actions['pair-go'] = async (el) => {
  const err = $('#pair-err');
  err.textContent = '';
  const code = $('#pair-code').value;
  if (code.replace(/[^A-Za-z0-9]/g, '').length !== 8) { err.textContent = 'The code has 8 letters and numbers.'; return; }
  el.disabled = true;
  el.textContent = 'Pairing…';
  try {
    const r = await api('pair', { code, device: $('#pair-name').value || 'iPhone' });
    M.token = r.token;
    await persist(true);
    cover(`${appIcon}<h1>Paired ✓</h1><p class="muted">Getting your data…</p>`);
    await sync();
    if (syncState.error) throw new Error(syncState.error);
    history.replaceState(null, '', location.pathname + '#home');
    start();
  } catch (e) {
    if (!M.token) {
      el.disabled = false;
      el.textContent = '🔑 Pair this phone';
      err.textContent = e.message;
    } else {
      start(); // paired; the first download will retry by itself
    }
  }
};

// ============================== app lock ==============================
function pinPad(id) {
  return `<div class="pin-dots" id="${id}">${'<i></i>'.repeat(4)}</div><div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-a="pin-key" data-v="${n}">${n}</button>`).join('')}
    <button class="blank"></button><button data-a="pin-key" data-v="0">0</button><button class="fn" data-a="pin-key" data-v="back" aria-label="Delete">${icon('backspace')}</button></div>`;
}

let pinEntry = null; // { digits, dots, done(pin) }
actions['pin-key'] = (el) => {
  if (!pinEntry) return;
  const v = el.dataset.v;
  pinEntry.digits = v === 'back' ? pinEntry.digits.slice(0, -1) : (pinEntry.digits + v).slice(0, 4);
  $$('i', $('#' + pinEntry.dots)).forEach((d, i) => d.classList.toggle('on', i < pinEntry.digits.length));
  if (pinEntry.digits.length === 4) {
    const pin = pinEntry.digits;
    pinEntry.digits = '';
    setTimeout(() => {
      $$('i', $('#' + pinEntry.dots)).forEach((d) => d.classList.remove('on'));
      pinEntry.done(pin);
    }, 120);
  }
};

let locked = false;
function lockApp() {
  if (!M.pinHash || locked) return Promise.resolve();
  locked = true;
  closeAllSheets();
  return new Promise((resolve) => {
    let fails = 0;
    const draw = (msg) => {
      cover(`${appIcon}<h2>Enter your PIN</h2><p class="small" style="color:var(--bad);min-height:18px">${esc(msg || '')}</p>${pinPad('lock-dots')}
        <button class="link" data-a="pin-forgot">Forgot PIN?</button>`);
    };
    draw();
    pinEntry = { digits: '', dots: 'lock-dots', done: async (pin) => {
      if (await hashPin(pin, M.pinSalt) === M.pinHash) {
        locked = false;
        pinEntry = null;
        $('#cover').hidden = true;
        $('#tabs').hidden = false;
        render();
        resolve();
        return;
      }
      fails++;
      if (fails >= 5) {
        draw('Too many tries. Wait 30 seconds.');
        const keep = pinEntry;
        pinEntry = null;
        setTimeout(() => { pinEntry = keep; fails = 3; draw(); }, 30000);
      } else {
        draw('Wrong PIN, try again.');
      }
    } };
  });
}
actions['pin-forgot'] = async () => {
  if (await confirmSheet('Forgot your PIN?', 'This unpairs the phone and removes the data from it. Your Google Sheet keeps everything; ask for a new pairing code to get it back.', 'Unpair phone', true)) {
    try { await api('unpair'); } catch (e) { /* offline */ }
    await wipeLocal();
    location.replace(location.pathname);
    location.reload();
  }
};

function askPin(title) {
  return new Promise((resolve) => {
    let result = null;
    openSheet(sheetHead(title) + `<div class="sheet-body" style="padding-bottom:28px">${pinPad('set-dots')}</div>`, {
      onClose: () => { pinEntry = null; resolve(result); },
    });
    pinEntry = { digits: '', dots: 'set-dots', done: (pin) => { result = pin; closeSheet(); } };
  });
}
actions['pin-toggle'] = async (el) => {
  const want = el.checked;
  el.checked = !want; // stays as it was unless the PIN steps finish
  if (want) {
    const a = await askPin('Choose a 4-digit PIN');
    if (!a) return;
    const b = await askPin('Type it again');
    if (!b) return;
    if (a !== b) return toast('The PINs didn’t match. Try again.');
    M.pinSalt = uid();
    M.pinHash = await hashPin(a, M.pinSalt);
    toast('App lock on 🔒');
  } else {
    const p = await askPin('Enter your PIN');
    if (!p) return;
    if (await hashPin(p, M.pinSalt) !== M.pinHash) return toast('Wrong PIN');
    M.pinHash = '';
    toast('App lock off');
  }
  persist();
  render();
};

// ============================== start-up ==============================
let started = false;
let reloadWhenFree = false;

function start() {
  $('#cover').hidden = true;
  $('#tabs').hidden = false;
  readHash();
  render();
  if (started) return;
  started = true;
  sync().then(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && setting('tz') !== tz) put('settings', { id: 'tz', value: tz }); // reminders go out in her time zone
  });
  refreshPush();
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 5 * 60 * 1000);
}

onUnpaired = async (msg) => {
  await wipeLocal();
  closeAllSheets();
  showPair(msg || 'This phone was unpaired. Ask for a new pairing code.');
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    M.hiddenAt = Date.now();
    persist(true);
    if (reloadWhenFree) location.reload();
    return;
  }
  if (!M.token) return;
  if (M.pinHash && Date.now() - (M.hiddenAt || 0) > 60000) lockApp();
  if (Date.now() - M.lastSync > 30000) sync();
  render(); // "today" may have changed
});
window.addEventListener('online', () => { syncState.online = true; sync(); });
window.addEventListener('offline', () => { syncState.online = false; emit(); });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => { /* still works, just not offline */ });
  // A new version arrived: switch to it now, or when she's not in the middle of something.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    if (sheetStack.length || locked) reloadWhenFree = true; else location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.go && M.token && !locked) go(e.data.go); });
}

(async function boot() {
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  try {
    await loadLocal();
  } catch (e) {
    cover(`${appIcon}<h1>Can’t open storage</h1><p class="muted">The phone didn’t let the app save data. If you’re in Private Browsing, switch it off, or open YH Tracker from the Home Screen.</p>`);
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!M.token) {
    if (isIOS() && !isStandalone()) showInstall(); else showPair();
    return;
  }
  if (M.pinHash) await lockApp();
  start();
})();
