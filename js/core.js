// Data on the phone (IndexedDB), the numbers worked out from it, and syncing with the Google Sheet.
'use strict';

const CFG = window.YH_CONFIG || {};
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
      const req = indexedDB.open('yh-tracker', 1);
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
  S = emptyState();
  M = emptyMeta();
  version++;
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
  scheduleSync(1200);
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
function totalBalance(upto) {
  const b = balances(upto);
  return accounts().reduce((s, a) => s + cents(b[a.id]), 0) / 100;
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
let onUnpaired = () => {};

async function api(fn, arg) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 45000);
  let res;
  try {
    res = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl && ctrl.signal,
      body: JSON.stringify(fn === 'pair' ? Object.assign({ fn }, arg) : { token: M.token, fn, args: [arg || {}] }) });
  } catch (e) {
    throw Object.assign(new Error('No internet connection. Your changes are safe on this phone.'), { offline: true });
  } finally {
    clearTimeout(timer);
  }
  let body;
  try { body = await res.json(); } catch (e) { throw new Error('The server didn’t answer properly. Try again in a minute.'); }
  if (!body.ok) {
    if (body.code === 'UNPAIRED' && fn !== 'pair') onUnpaired(body.error);
    throw new Error(body.error || 'Something went wrong.');
  }
  return body.result;
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
    TABLES.forEach((t) => {
      const ids = Object.keys(M.dirty[t]);
      if (!ids.length) return;
      changes[t] = ids.map((id) => S[t][id]).filter(Boolean);
      sent[t] = {};
      changes[t].forEach((r) => { sent[t][r.id] = r.updatedAt; });
    });
    try {
      const res = await api('sync', { since: M.cursor, changes });
      let got = 0;
      Object.keys(res.changes || {}).forEach((t) => {
        if (!S[t]) return;
        res.changes[t].forEach((rec) => {
          const mine = S[t][rec.id];
          if (mine && M.dirty[t][rec.id] && mine.updatedAt > rec.updatedAt) return; // changed again here since
          S[t][rec.id] = rec;
          got++;
        });
      });
      Object.keys(sent).forEach((t) => Object.keys(sent[t]).forEach((id) => {
        if (S[t][id] && S[t][id].updatedAt === sent[t][id]) delete M.dirty[t][id];
      }));
      M.cursor = res.cursor;
      M.lastSync = Date.now();
      syncState = { online: true, error: '' };
      if (got) version++;
      await persist(true);
      if (got) emit();
    } catch (e) {
      syncState = { online: !e.offline, error: e.message };
      if (e.offline) scheduleSync(30000);
    }
  })();
  try { await syncing; } finally { syncing = null; }
  if (syncAgain) { syncAgain = false; return sync(); }
  emit();
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
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked. Turn them on in iPhone Settings ▸ Notifications ▸ YH Tracker.' : 'Notifications weren’t allowed.');
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
