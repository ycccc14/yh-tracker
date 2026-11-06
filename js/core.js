// Data on the phone (IndexedDB), the numbers worked out from it, and syncing with the Google Sheet.
'use strict';

const CFG = self.YH_CONFIG || {};
const TABLES = ['accounts', 'categories', 'transactions', 'reminders', 'settings'];

// ============================== small helpers ==============================

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cents = (x) => Math.round((Number(x) || 0) * 100);
const uid = () => {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');
};

function today() {
  const d = new Date();
  return Shared.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
const thisMonth = () => today().slice(0, 7);
function shiftMonth(ym, n) { const [y, m] = ym.split('-').map(Number); return Shared.ymd(y, m + n, 1).slice(0, 7); }
function monthEnd(ym) { const [y, m] = ym.split('-').map(Number); return Shared.ymd(y, m, Shared.daysInMonth(y, m)); }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dateParts(s) { const [y, m, d] = s.split('-').map(Number); return { y, m, d, w: new Date(y, m - 1, d).getDay() }; }
function fmtDate(s, withYear) {
  if (!s) return '';
  const p = dateParts(s);
  return DAYS[p.w] + ', ' + p.d + ' ' + MONTHS[p.m - 1] + (withYear || p.y !== new Date().getFullYear() ? ' ' + p.y : '');
}
function fmtDay(s) {
  const diff = Shared.daysBetween(today(), s);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return fmtDate(s);
}
const fmtMonth = (ym) => MONTHS_LONG[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);
const fmtMonthShort = (ym) => MONTHS[+ym.slice(5) - 1];

const numFmt = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Amount for screens: dots instead of digits while the privacy eye is on.
function amt(x, opts) {
  return M.hideAmounts ? (setting('currency') || 'RM') + ' ••••' : money(x, opts);
}
function money(x, opts) {
  opts = opts || {};
  const v = Number(x) || 0;
  const cur = setting('currency') || 'RM';
  const sign = v < 0 ? '−' : opts.plus && v > 0 ? '+' : '';
  return sign + cur + ' ' + numFmt.format(Math.abs(v));
}
// Short form for chart labels: RM 1.2k
function moneyShort(x) {
  const v = Math.abs(x);
  const s = v >= 1e6 ? (v / 1e6).toFixed(1) + 'm' : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'k' : String(Math.round(v));
  return (x < 0 ? '−' : '') + s;
}

// ============================== storage ==============================

const DB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CFG.db || 'yh-tracker', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },
  get(key) {
    return this.open().then((db) => new Promise((resolve, reject) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  },
  set(pairs) {
    return this.open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      Object.keys(pairs).forEach((k) => (pairs[k] === undefined ? tx.objectStore('kv').delete(k) : tx.objectStore('kv').put(pairs[k], k)));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  },
};

function emptyState() { const s = {}; TABLES.forEach((t) => { s[t] = {}; }); return s; }
function emptyMeta() { const d = {}; TABLES.forEach((t) => { d[t] = {}; }); return { token: '', cursor: 0, dirty: d, lastSync: 0 }; }

let S = emptyState(); // the data
let M = emptyMeta(); // this phone: token, sync cursor, unsent changes, lock, preferences
let version = 0; // bumps on every change; selectors cache by it

async function loadLocal() {
  const [s, m] = await Promise.all([DB.get('state'), DB.get('meta')]);
  S = Object.assign(emptyState(), s || {});
  M = Object.assign(emptyMeta(), m || {});
  TABLES.forEach((t) => { M.dirty[t] = M.dirty[t] || {}; });
  version++;
}

let saveTimer = 0;
function persist(now) {
  clearTimeout(saveTimer);
  const go = () => DB.set({ state: S, meta: M }).catch((e) => console.error('save failed', e));
  if (now) return go();
  saveTimer = setTimeout(go, 120);
  return null;
}

async function wipeLocal() {
  dataKeyCache = null;
  S = emptyState();
  M = emptyMeta();
  version++;
  Theme.clear();
  await DB.set({ state: undefined, meta: undefined });
}

// Saves a record on the phone and queues it for the sheet.
let lastStamp = 0;
function put(table, rec) {
  const now = Math.max(Date.now(), lastStamp + 1);
  lastStamp = now;
  rec = Object.assign({}, rec, { updatedAt: now, deleted: !!rec.deleted });
  S[table][rec.id] = rec;
  M.dirty[table][rec.id] = 1;
  version++;
  persist();
  scheduleSync(400); // back it up straight away (several quick changes still go in one upload)
  emit();
  return rec;
}
const remove = (table, id) => S[table][id] && put(table, Object.assign({}, S[table][id], { deleted: true }));

// Re-render hook (set by main.js).
let onChange = () => {};
function emit() { onChange(); }

// ============================== reading the data ==============================

const memo = {};
function cached(key, fn) {
  const m = memo[key];
  if (m && m.v === version) return m.r;
  const r = fn();
  memo[key] = { v: version, r };
  return r;
}

const live = (table) => cached('live:' + table, () => Object.values(S[table]).filter((r) => !r.deleted));
const setting = (id) => (S.settings[id] && !S.settings[id].deleted ? S.settings[id].value : '');
const acc = (id) => S.accounts[id];
const cat = (id) => S.categories[id];

function accounts(all) {
  return cached('accounts' + !!all, () => live('accounts').filter((a) => all || !a.archived)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)));
}

// Categories of a kind; by default the most used (last 90 days) first.
function categories(kind, byUse) {
  return cached('cats' + kind + !!byUse, () => {
    const list = live('categories').filter((c) => c.kind === kind && !c.archived);
    const order = (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
    if (!byUse) return list.sort(order);
    const since = Shared.addDays(today(), -90);
    const use = {};
    live('transactions').forEach((t) => { if (t.date >= since) use[t.categoryId] = (use[t.categoryId] || 0) + 1; });
    return list.sort((a, b) => (use[b.id] || 0) - (use[a.id] || 0) || order(a, b));
  });
}

const txSorted = () => cached('txSorted', () => live('transactions').sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.updatedAt - a.updatedAt)));
const txInMonth = (ym) => cached('txm' + ym, () => txSorted().filter((t) => t.date.slice(0, 7) === ym));

// How a transaction changes one account, in cents.
function effect(t, accId) {
  const a = cents(t.amount);
  if (t.type === 'income') return t.accountId === accId ? a : 0;
  if (t.type === 'expense') return t.accountId === accId ? -a : 0;
  if (t.type === 'adjust') return t.accountId === accId ? a : 0;
  if (t.type === 'transfer') return (t.toAccountId === accId ? a : 0) - (t.accountId === accId ? a : 0);
  return 0;
}

// Balance of every account at the end of `upto` (a date, default: everything), in RM.
function balances(upto) {
  return cached('bal' + (upto || ''), () => {
    const c = {};
    const add = (id, v) => { if (c[id] !== undefined) c[id] += v; };
    live('accounts').forEach((a) => { c[a.id] = cents(a.opening); });
    live('transactions').forEach((t) => {
      if (upto && t.date > upto) return;
      const a = cents(t.amount);
      if (t.type === 'income' || t.type === 'adjust') add(t.accountId, a);
      else if (t.type === 'expense') add(t.accountId, -a);
      else if (t.type === 'transfer') { add(t.accountId, -a); add(t.toAccountId, a); }
    });
    const out = {};
    Object.keys(c).forEach((k) => { out[k] = c[k] / 100; });
    return out;
  });
}
// Net worth: every account that counts in the total (debts are negative balances).
function totalBalance(upto) {
  const b = balances(upto);
  return accounts(true).filter((a) => !a.excluded).reduce((s, a) => s + cents(b[a.id]), 0) / 100;
}
function netWorth() {
  const b = balances();
  let assets = 0;
  let debts = 0;
  accounts(true).filter((a) => !a.excluded).forEach((a) => { const v = cents(b[a.id]); if (v >= 0) assets += v; else debts -= v; });
  return { assets: assets / 100, debts: debts / 100, net: (assets - debts) / 100 };
}

// Income and spending in a month (transfers and balance fixes aren't income or spending).
function monthTotals(ym, accId) {
  return cached('mt' + ym + (accId || ''), () => {
    let inc = 0;
    let exp = 0;
    let moveIn = 0;
    let moveOut = 0;
    txInMonth(ym).forEach((t) => {
      if (accId) {
        const e = effect(t, accId);
        if (e > 0) moveIn += e; else moveOut -= e;
      }
      if (accId && t.accountId !== accId) return;
      if (t.type === 'income') inc += cents(t.amount);
      if (t.type === 'expense') exp += cents(t.amount);
    });
    return { income: inc / 100, expense: exp / 100, net: (inc - exp) / 100, moneyIn: moveIn / 100, moneyOut: moveOut / 100 };
  });
}

// Spending in a month up to a day of the month (for "vs the same time last month").
function spentUpTo(ym, day) {
  return txInMonth(ym).reduce((s, t) => s + (t.type === 'expense' && +t.date.slice(8) <= day ? cents(t.amount) : 0), 0) / 100;
}

// {categoryId: amount} for one kind in a period: 'YYYY-MM' or 'YYYY'.
function byCategoryIn(period, kind) {
  return cached('bcp' + period + kind, () => {
    const out = {};
    txSorted().forEach((t) => { if (t.type === kind && t.date.indexOf(period) === 0) out[t.categoryId] = (out[t.categoryId] || 0) + cents(t.amount); });
    Object.keys(out).forEach((k) => { out[k] /= 100; });
    return out;
  });
}

// {categoryId: amount} for one kind in a month.
function byCategory(ym, kind) {
  return cached('bc' + ym + kind, () => {
    const out = {};
    txInMonth(ym).forEach((t) => { if (t.type === kind) out[t.categoryId] = (out[t.categoryId] || 0) + cents(t.amount); });
    Object.keys(out).forEach((k) => { out[k] /= 100; });
    return out;
  });
}

// Budget state for a category: spent, budget, share used and a level (ok / warn at 80% / over).
function budgetOf(c, ym) {
  const spent = byCategory(ym, 'expense')[c.id] || 0;
  const budget = Number(c.budget) || 0;
  const pct = budget ? spent / budget : 0;
  return { spent, budget, left: Calc.round2(budget - spent), pct, level: !budget ? 'none' : pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok' };
}

const reminders = () => cached('rems', () => live('reminders').sort((a, b) => (a.due > b.due ? 1 : a.due < b.due ? -1 : 0)));
const activeBills = () => reminders().filter((r) => r.active && Shared.isDate(r.due));
const billsAttention = () => cached('attn', () => Shared.billsNeedingAttention(activeBills(), today()));

// ============================== talking to the sheet ==============================

let syncing = null;
let syncAgain = false;
let syncTimer = 0;
let syncState = { online: navigator.onLine !== false, error: '' };
let onSignedOut = () => {};

async function api(fn, arg) {
  if (CFG.demo) return demoApi(fn);
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 45000);
  let res;
  try {
    res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl && ctrl.signal,
      body: JSON.stringify({ token: M.token, fn, args: [arg || {}] }) });
  } catch (e) {
    throw Object.assign(new Error('No internet connection. Your changes are safe on this phone.'), { offline: true });
  } finally {
    clearTimeout(timer);
  }
  let body;
  try { body = await res.json(); } catch (e) { throw new Error('The server didn’t answer properly. Try again in a minute.'); }
  if (!body.ok) {
    if (body.code === 'SIGNED_OUT' && M.token) onSignedOut(body.error);
    throw new Error(body.error || 'Something went wrong.');
  }
  return body.result;
}

// Preview builds run on sample data kept on the phone: nothing is sent anywhere.
function demoApi(fn) {
  if (fn === 'sync') return { cursor: 1, changes: {}, requests: [] };
  if (fn === 'signOut') return {};
  throw new Error('Not available in the demo. It works in the real app.');
}

// The data key (unlocks this user's records), cached as a CryptoKey.
let dataKeyCache = null;
async function dataKey() {
  if (!dataKeyCache) dataKeyCache = await Crypt.dataKey(M.dk);
  return dataKeyCache;
}

// Reminder times for the next 60 days, for the server's push timer: times only, no names or amounts.
function reminderSchedule() {
  const end = Shared.addDays(today(), 60) + ' 23:59';
  const list = [];
  activeBills().forEach((r) => Shared.notifyMoments(r).forEach((m) => { if (m.at <= end) list.push({ k: `${r.id}|${r.due}|${m.stage}`, at: m.at }); }));
  list.sort((a, b) => (a.at > b.at ? 1 : -1));
  return { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', list: list.slice(0, 150) };
}

const unsentCount = () => TABLES.reduce((n, t) => n + Object.keys(M.dirty[t]).length, 0);

function scheduleSync(ms) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), ms || 0);
}

async function sync() {
  if (!M.token) return;
  if (syncing) { syncAgain = true; return syncing; }
  syncing = (async () => {
    const sent = {};
    const changes = {};
    try {
      // Every record is encrypted before it leaves the phone.
      const key = CFG.demo ? null : await dataKey();
      for (const t of TABLES) {
        const list = Object.keys(M.dirty[t]).map((id) => S[t][id]).filter(Boolean);
        if (!list.length) continue;
        sent[t] = {};
        changes[t] = [];
        for (const r of list) {
          sent[t][r.id] = r.updatedAt;
          changes[t].push({ id: r.id, updatedAt: r.updatedAt, deleted: !!r.deleted, data: key ? await Crypt.sealJson(key, r) : '' });
        }
      }
      const taken = (M.inboxDone || []).slice(); // widget records already added here: clear them from the inbox
      if (taken.length) changes.inbox = taken;
      if ((M.answers || []).length) await sendAnswers(); // answers to data requests go first
      const sch = reminderSchedule();
      const schText = JSON.stringify(sch);
      const res = await api('sync', { since: M.cursor, changes, schedule: schText !== M.schedSent ? sch : undefined });
      let got = 0;
      for (const t of Object.keys(res.changes || {})) {
        if (!S[t]) continue;
        for (const enc of res.changes[t]) {
          let rec;
          try { rec = await Crypt.openJson(key, enc.data); } catch (e) { console.error('Could not open a record', t, enc.id); continue; }
          const mine = S[t][rec.id];
          if (mine && M.dirty[t][rec.id] && mine.updatedAt > rec.updatedAt) continue; // changed again here since
          S[t][rec.id] = rec;
          got++;
        }
      }
      M.inboxDone = (M.inboxDone || []).filter((a) => !taken.some((b) => b.id === a.id));
      if ((res.changes || {}).inbox) await takeWidgetInbox(res.changes.inbox);
      M.schedSent = schText;
      if (res.requests) { M.requests = res.requests; applyAnswers(); }
      if (res.me && M.user) M.user = Object.assign({}, M.user, res.me);
      Object.keys(sent).forEach((t) => Object.keys(sent[t]).forEach((id) => {
        if (S[t][id] && S[t][id].updatedAt === sent[t][id]) delete M.dirty[t][id];
      }));
      M.cursor = res.cursor;
      M.lastSync = Date.now();
      syncState = { online: true, error: '' };
      if (got) version++;
      await persist(true);
      if (got) emit();
      pushWidget().catch(() => {}); // tries again after the next sync
    } catch (e) {
      syncState = { online: !e.offline, error: e.message };
      if (e.offline) scheduleSync(30000);
    }
  })();
  try { await syncing; } finally { syncing = null; }
  if (syncAgain) { syncAgain = false; return sync(); }
  emit();
}

// Bills set to "record automatically": once the due date arrives, record the payment and move
// the bill on (catching up on any missed ones). Ids are fixed per bill and due date, so two
// phones doing this at once make the same record, not two.
function autoRecordBills() {
  const t = today();
  let made = 0;
  activeBills().forEach((r0) => {
    let r = r0;
    for (let i = 0; i < 60 && r.auto && r.active && r.amount > 0 && acc(r.accountId) && r.due <= t; i++) {
      const id = 'auto-' + r.id + '-' + r.due;
      if (!S.transactions[id]) {
        const fallback = categories('expense').find((c) => /^Bills/.test(c.name)) || {};
        put('transactions', { id, date: r.due, type: 'expense', amount: r.amount, accountId: r.accountId, toAccountId: '', categoryId: r.categoryId || fallback.id || '', note: r.title });
        made++;
      }
      const next = Shared.nextDue(r);
      r = put('reminders', Object.assign({}, r, { lastPaid: r.due, due: next || r.due, active: !!next }));
    }
  });
  return made;
}

// ============================== notifications ==============================

const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// 'unsupported' | 'install' (iPhone, but not opened from the Home Screen) | 'default' | 'denied' | 'on'
function pushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() && !isStandalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && M.pushOn) return 'on';
  return 'default';
}

function keyBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked. Turn them on in iPhone Settings ▸ Notifications ▸ My Tracker.' : 'Notifications weren’t allowed.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('pushKey');
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const current = sub.options && sub.options.applicationServerKey;
    if (current && btoa(String.fromCharCode.apply(null, new Uint8Array(current))).replace(/=+$/, '') !== btoa(String.fromCharCode.apply(null, keyBytes(key))).replace(/=+$/, '')) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api('subscribe', { endpoint: sub.endpoint });
  M.pushOn = true;
  M.pushChecked = Date.now();
  persist();
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (e) { /* already gone */ }
  M.pushOn = false;
  persist();
  await api('unsubscribe');
}

// Once a day, make sure the server still has this phone's (possibly renewed) push address.
async function refreshPush() {
  if (!M.pushOn || Date.now() - (M.pushChecked || 0) < 86400000 || pushState() !== 'on') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) { M.pushOn = false; persist(); emit(); return; }
    await api('subscribe', { endpoint: sub.endpoint });
    M.pushChecked = Date.now();
    persist();
  } catch (e) { /* try again next time */ }
}

async function testPush() {
  M.testPushAt = Date.now(); // the service worker shows "it works" instead of bills for a few minutes
  await persist(true);
  const r = await api('testPush');
  if (!(r.status >= 200 && r.status < 300)) throw new Error('The notification couldn’t be sent (code ' + r.status + '). Try turning notifications off and on.');
}

// Number on the app icon: bills overdue or inside their reminder window.
function updateBadge() {
  const n = billsAttention().length;
  try {
    if (n && navigator.setAppBadge) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch (e) { /* not supported */ }
}

// ============================== app lock ==============================

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================== a new account's starting data ==============================

const DEFAULT_CATEGORIES = [
  ['expense', '🍜', 'Food & drinks'], ['expense', '🛒', 'Groceries'], ['expense', '🚗', 'Transport'], ['expense', '⛽', 'Petrol'],
  ['expense', '🏠', 'Rent & housing'], ['expense', '💡', 'Bills & utilities'], ['expense', '📱', 'Phone & internet'],
  ['expense', '🛍️', 'Shopping'], ['expense', '💊', 'Health'], ['expense', '🎬', 'Entertainment'], ['expense', '📚', 'Education'],
  ['expense', '🛡️', 'Insurance'], ['expense', '👨‍👩‍👧', 'Family'], ['expense', '🎁', 'Gifts'], ['expense', '✈️', 'Travel'],
  ['expense', '💳', 'Loan & credit card'], ['expense', '📦', 'Others'],
  ['income', '💼', 'Salary'], ['income', '🎉', 'Bonus'], ['income', '💻', 'Side income'], ['income', '🏦', 'Interest & dividends'],
  ['income', '🧧', 'Gift & angpao'], ['income', '↩️', 'Refund'], ['income', '📦', 'Other income'],
];

function seedDefaults(name) {
  DEFAULT_CATEGORIES.forEach((c, i) => put('categories', { id: 'cat' + Shared.pad(i), kind: c[0], icon: c[1], name: c[2], budget: 0, order: i, archived: false }));
  put('settings', { id: 'name', value: name || '' });
  put('settings', { id: 'currency', value: 'RM' });
}
