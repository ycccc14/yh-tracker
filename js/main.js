// Start-up, navigation, pairing, the install guide and the app lock.
'use strict';

// ============================== navigation ==============================
let lastRoute = '';
let renderQueued = false;

function render() {
  renderQueued = false;
  if (!M.token || !$('#cover').hidden) return;
  Theme.follow(setting('theme'));
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
  $('.tab-dot').hidden = !billsAttention().some((x) => x.days <= 0) && !pendingRequests().length; // on Home: bills due, or a data request
  updateBadge();
  maybePromptRequest();
  reloadIfFree();
  if (view.route === 'widget') paintWidgetPreviews();
  if (wantAdd) {
    const type = wantAdd;
    wantAdd = '';
    closeAllSheets();
    if (accounts().length) openTxEditor(null, { type }); else toast('Add an account first');
  }
}

// Redraw after data changes, at most once per frame.
onChange = () => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
};

// #add/expense, #add/income, #add/transfer: a widget's button. Opens that form as soon as the app is on screen.
let wantAdd = '';

function readHash() {
  let [r, a] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (r === 'add') {
    wantAdd = ['expense', 'income', 'transfer'].includes(a) ? a : 'expense';
    history.replaceState(null, '', location.pathname + location.search + '#home');
    [r, a] = ['home', ''];
  }
  r = ROUTE_ALIAS[r] || r;
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
  view.year = +next.slice(0, 4);
  render();
};
actions.year = (el) => {
  const y = view.year + Number(el.dataset.d);
  if (y > +thisMonth().slice(0, 4)) return;
  view.year = y;
  view.month = y === +thisMonth().slice(0, 4) ? thisMonth() : y + '-12';
  render();
};
actions['cat-records'] = (el) => {
  Object.assign(view, { recType: 'all', recAcc: '', recCat: el.dataset.id, recQuery: '', recMode: 'list' });
  go('records');
};
actions['rec-mode'] = (el) => { view.recMode = el.dataset.v; render(); };
actions['cal-day'] = (el) => { view.recDay = el.dataset.v; render(); };
actions['stat-period'] = (el) => { view.statPeriod = el.dataset.v; render(); };
actions['stat-kind'] = (el) => { view.statKind = el.dataset.v; render(); };
actions['toggle-hidden'] = () => { view.showHidden = !view.showHidden; render(); };
actions['cat-sort'] = () => { view.catSort = !view.catSort; render(); };
actions.noop = () => {};
const setPrivacy = (on) => { M.hideAmounts = on; persist(); render(); toast(on ? 'Amounts hidden 🙈' : 'Amounts shown'); };
actions.privacy = () => setPrivacy(!M.hideAmounts);
actions['privacy-toggle'] = (el) => setPrivacy(el.checked);
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
actions['push-toggle'] = async (el) => {
  const on = el.checked;
  el.disabled = true;
  try {
    if (on) { await enablePush(); toast('Notifications on ✓'); } else { await disablePush(); toast('Notifications off'); }
  } catch (e) {
    el.checked = !on;
    toast(e.message, 4500);
  }
  el.disabled = false;
  render();
};
actions['push-nag-off'] = () => { M.pushNagOff = true; persist(); render(); toast('You can turn them on later in Settings ▸ Notifications'); };
actions['push-test'] = async (el) => {
  el.disabled = true;
  try {
    await testPush();
    M.pushTested = true;
    persist();
    render();
    toast('Sent — it should arrive in a few seconds');
  } catch (e) {
    toast(e.message, 4500);
  }
  el.disabled = false;
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
  const text = '﻿' + rows.join('\r\n');
  if (Native) { Native.saveFile(`My-Tracker-${today()}.csv`, 'text/csv', text); return; }
  const file = new File([text], `My-Tracker-${today()}.csv`, { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My Tracker records' }); return; }
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
  cover(`${appIcon}<div><h1>Install My Tracker</h1><p class="muted" style="margin-top:6px">Add it to your Home Screen so it opens like a normal app, works offline and can remind you about bills.</p></div>
    <section class="card"><ol class="steps">
      <li><span>Tap the <b>Share</b> button <span style="display:inline-block;vertical-align:-5px;color:var(--series-income)">${icon('share')}</span> at the bottom of Safari.</span></li>
      <li><span>Scroll down and tap <b>Add to Home Screen</b>.</span></li>
      <li><span>Tap <b>Add</b>, then open <b>My Tracker</b> from your Home Screen.</span></li></ol></section>
    <p class="muted small">Prefer not to install? <button class="link" data-a="skip-install">Continue in the browser</button></p>`);
}
actions['skip-install'] = () => (CFG.demo ? startDemo() : showWelcome());

// Preview build: no sign-in; fill the phone with sample data and go.
function startDemo() {
  seedDemo();
  M.token = 'demo';
  persist(true);
  start();
}
actions['demo-reset'] = async () => {
  if (!(await confirmSheet('Start the preview over?', 'Your changes to the sample data are removed.', 'Start over', true))) return;
  await wipeLocal();
  startDemo();
  go('home');
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
  if (await confirmSheet('Forgot your PIN?', 'You’ll be signed out on this phone. Your data is safe online: sign in again with your password to get it back.', 'Sign out', true)) {
    try { await api('signOut'); } catch (e) { /* offline: the session is forgotten anyway */ }
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
let lastPush = null; // the last notification that arrived while the app was open
let reloadWhenFree = false; // a new version is waiting: switch as soon as she's not in the middle of something
let swReg = null;

// Ask for a new version of the app (when it comes to the front, and every few minutes while open).
function checkForUpdate() {
  if (swReg) swReg.update().catch(() => { /* offline */ });
}
function reloadIfFree() {
  if (!reloadWhenFree || sheetStack.length || locked) return;
  try { sessionStorage.setItem('yh-updated', '1'); } catch (e) { /* private mode */ }
  location.reload();
}
whenSheetsClosed = reloadIfFree;

function start() {
  $('#cover').hidden = true;
  $('#tabs').hidden = false;
  readHash();
  render();
  if (started) return;
  started = true;
  autoRecordBills();
  sync().then(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && setting('tz') !== tz) put('settings', { id: 'tz', value: tz }); // reminders go out in her time zone
    autoRecordBills(); // bills set to record automatically (also catches up on missed ones)
  });
  refreshPush();
  // While the app is open, changes from other phones (and new data requests) arrive within ~20 s.
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 20000);
  setInterval(() => { if (document.visibilityState === 'visible') checkForUpdate(); }, 5 * 60 * 1000);
}

onSignedOut = async (msg) => {
  await wipeLocal();
  closeAllSheets();
  showWelcome(msg || 'You were signed out. Please sign in again.');
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    M.hiddenAt = Date.now();
    persist(true);
    if (reloadWhenFree) location.reload(); // switch to the new version while she's away
    return;
  }
  checkForUpdate();
  if (!M.token) return;
  if (M.pinHash && Date.now() - (M.hiddenAt || 0) > 60000) lockApp();
  sync(); // back in front: fetch anything new straight away
  autoRecordBills();
  render(); // "today" may have changed
});
window.addEventListener('online', () => { syncState.online = true; sync(); });
window.addEventListener('offline', () => { syncState.online = false; emit(); });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => { swReg = reg; }).catch(() => { /* still works, just not offline */ });
  // A new version arrived: switch to it now, or as soon as she closes what she's doing.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    reloadWhenFree = true;
    reloadIfFree();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.pushed && M.token) { // a notification just arrived while the app is open
      lastPush = e.data.pushed;
      if (lastPush.go === 'request') sync(); // the new request then opens by itself
      return;
    }
    if (!e.data || !e.data.go || !M.token) return;
    if (e.data.go === 'request') showRequestFromNotification(e.data.request); else if (!locked) go(e.data.go);
  });
}

(async function boot() {
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  try {
    if (sessionStorage.getItem('yh-updated')) { sessionStorage.removeItem('yh-updated'); setTimeout(() => toast('Updated to the latest version ✓'), 600); }
  } catch (e) { /* private mode */ }
  try {
    await loadLocal();
  } catch (e) {
    cover(`${appIcon}<h1>Can’t open storage</h1><p class="muted">The phone didn’t let the app save data. If you’re in Private Browsing, switch it off, or open My Tracker from the Home Screen.</p>`);
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const opened = new URLSearchParams(location.search);
  if (opened.get('open') === 'request') { // opened by tapping a data-request notification
    try { knowRequest(JSON.parse(opened.get('r') || 'null')); } catch (e) { /* no request in the link */ }
    wantRequest = Date.now();
    history.replaceState(null, '', location.pathname + '#home');
  }
  if (M.token && !M.dk && !CFG.demo) { // signed in with the old pairing (before logins): start fresh
    await wipeLocal();
    showWelcome('My Tracker now has its own login, and your data is locked with your password. Sign in, or create your account with an invite code.');
    return;
  }
  if (!M.token) {
    const fromWidget = opened.has('w'); // an iPhone widget can only open Safari: go straight to signing in there
    if (isIOS() && !isStandalone() && !fromWidget) showInstall(); else if (CFG.demo) startDemo(); else showWelcome();
    return;
  }
  if (M.pinHash) await lockApp();
  start();
})();
