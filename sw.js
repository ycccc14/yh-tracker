// Keeps the app's files on the phone (opens instantly, works offline) and shows bill notifications.
// Pushes from the server are empty: the text comes from the bills stored on this phone, so it is
// always current (a bill paid a minute ago isn't mentioned) and nothing personal travels via Apple.
importScripts('config.js?v=ea1e50390f', 'shared.js?v=ea1e50390f');

const CACHE = 'yh-ea1e50390f';
const FILES = ["./", "index.html", "manifest.webmanifest", "config.js?v=ea1e50390f", "shared.js?v=ea1e50390f", "app.css?v=ea1e50390f", "js/account.js?v=ea1e50390f", "js/calc.js?v=ea1e50390f", "js/core.js?v=ea1e50390f", "js/crypto.js?v=ea1e50390f", "js/demo.js?v=ea1e50390f", "js/editors.js?v=ea1e50390f", "js/main.js?v=ea1e50390f", "js/screens.js?v=ea1e50390f", "js/theme.js?v=ea1e50390f", "js/ui.js?v=ea1e50390f", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-32.png", "icons/icon-512-maskable.png", "icons/icon-512.png", "logos/aeon.png", "logos/affin.png", "logos/agro.png", "logos/alliance.png", "logos/ambank.png", "logos/asb.png", "logos/atome.png", "logos/bigpay.png", "logos/bimb.png", "logos/boost.png", "logos/boostbank.png", "logos/bsn.png", "logos/cimb.png", "logos/grab.png", "logos/grabpl.png", "logos/gxbank.png", "logos/hlb.png", "logos/hsbc.png", "logos/kwsp.png", "logos/mae.png", "logos/maybank.png", "logos/muamalat.png", "logos/ocbc.png", "logos/pbb.png", "logos/rakyat.png", "logos/rhb.png", "logos/ryt.png", "logos/scb.png", "logos/setel.png", "logos/shopee.png", "logos/spaylater.png", "logos/stashaway.png", "logos/th.png", "logos/tng.png", "logos/tngcard.png", "logos/uob.png", "logos/versa.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // the API always goes to the network
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

function idbGet(key) {
  return new Promise((resolve) => {
    const req = indexedDB.open((self.YH_CONFIG || {}).db || 'yh-tracker', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      try {
        const r = req.result.transaction('kv').objectStore('kv').get(key);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    };
  });
}

function money(v, cur) {
  return (cur || 'RM') + ' ' + Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function when(days) {
  if (days < 0) return 'overdue ' + -days + (days === -1 ? ' day' : ' days');
  return 'due ' + Shared.relDays(days);
}

// Pushes are empty, so ask the server why this one was sent ({why: 'request' | 'bills', requests}),
// but never for long: iOS drops a push whose notification isn't shown promptly. null = couldn't tell.
async function askInbox(meta) {
  const cfg = self.YH_CONFIG || {};
  if (!meta || !meta.token || !cfg.api || cfg.demo) return { why: 'bills', requests: [] };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(cfg.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl.signal,
      body: JSON.stringify({ token: meta.token, fn: 'inbox', args: [{}] }) });
    const body = await res.json();
    return body.ok ? body.result : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function reminderText() {
  const [state, meta] = await Promise.all([idbGet('state'), idbGet('meta')]);
  if (meta && meta.testPushAt && Date.now() - meta.testPushAt < 5 * 60 * 1000) {
    return { title: 'Notifications work ✅', body: 'You’ll get a reminder like this before your bills are due.', go: 'bills' };
  }
  const inbox = await askInbox(meta);
  const request = inbox && (inbox.why === 'request' || (inbox.why !== 'bills' && inbox.requests.length > 0));
  // The request goes along with the notification, so tapping it opens Approve / Decline at once.
  if (request) return { title: '📨 YC asks for a copy of your data', body: 'Tap to approve or decline.', tag: 'request', go: 'request', request: inbox.requests[0] || null };
  const d = new Date();
  const today = Shared.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const rems = state && state.reminders ? Object.values(state.reminders) : [];
  const cur = state && state.settings && state.settings.currency ? state.settings.currency.value : 'RM';
  const list = Shared.billsNeedingAttention(rems, today);
  if (!list.length) return inbox === null ? { title: 'My Tracker', body: 'You have something new. Tap to open.', go: 'request' } : { title: 'My Tracker', body: 'Tap to check your bills.', go: 'bills' };
  if (list.length === 1) {
    const x = list[0];
    return { title: `🔔 ${x.rem.title} ${when(x.days)}`, body: (x.rem.amount ? money(x.rem.amount, cur) + ' · ' : '') + 'Tap to mark it as paid.', go: 'bills' };
  }
  return {
    title: `🔔 ${list.length} bills need attention`,
    body: list.slice(0, 4).map((x) => `${x.rem.title} (${when(x.days)})`).join(', ') + (list.length > 4 ? '…' : ''),
    count: list.length,
    go: 'bills',
  };
}

self.addEventListener('push', (e) => {
  // A notification must always appear, even if working out the text fails.
  e.waitUntil(reminderText().catch(() => ({ title: 'My Tracker', body: 'Tap to open.', go: 'request' })).then((m) => {
    const shown = self.registration.showNotification(m.title, {
      body: m.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: m.tag || 'bills', renotify: true, data: { go: m.go, request: m.request || null },
    });
    if (self.navigator.setAppBadge && m.count) self.navigator.setAppBadge(m.count).catch(() => {});
    // If the app is open, tell it too (a data request then shows straight away).
    const tell = self.clients.matchAll({ type: 'window' }).then((list) => list.forEach((c) => c.postMessage({ pushed: { title: m.title, go: m.go } })));
    return Promise.all([shown, tell]);
  }));
});

// Tapping a notification opens the app on the right thing: a data request opens its Approve / Decline sheet.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const go = data.go || 'bills';
  const request = data.request || null;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      c.postMessage({ go, request });
      return c.focus();
    }
    if (go !== 'request') return self.clients.openWindow('./#' + go);
    return self.clients.openWindow('./?open=request' + (request ? '&r=' + encodeURIComponent(JSON.stringify(request)) : '') + '#home');
  }));
});
