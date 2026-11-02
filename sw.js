// Keeps the app's files on the phone (opens instantly, works offline) and shows bill notifications.
// Pushes from the server are empty: the text comes from the bills stored on this phone, so it is
// always current (a bill paid a minute ago isn't mentioned) and nothing personal travels via Apple.
importScripts('config.js?v=a501c0406d', 'shared.js?v=a501c0406d');

const CACHE = 'yh-a501c0406d';
const FILES = ["./", "index.html", "manifest.webmanifest", "config.js?v=a501c0406d", "shared.js?v=a501c0406d", "app.css?v=a501c0406d", "js/account.js?v=a501c0406d", "js/calc.js?v=a501c0406d", "js/core.js?v=a501c0406d", "js/crypto.js?v=a501c0406d", "js/demo.js?v=a501c0406d", "js/editors.js?v=a501c0406d", "js/main.js?v=a501c0406d", "js/screens.js?v=a501c0406d", "js/ui.js?v=a501c0406d", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-32.png", "icons/icon-512-maskable.png", "icons/icon-512.png"];

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

// Is the owner asking for a copy of the data? (Pushes are empty, so ask the server.)
async function hasRequest(meta) {
  const cfg = self.YH_CONFIG || {};
  if (!meta || !meta.token || !cfg.api || cfg.demo) return false;
  try {
    const res = await fetch(cfg.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: meta.token, fn: 'inbox', args: [{}] }) });
    const body = await res.json();
    return !!(body.ok && body.result.requests.length);
  } catch (e) {
    return false;
  }
}

async function reminderText() {
  const [state, meta] = await Promise.all([idbGet('state'), idbGet('meta')]);
  if (meta && meta.testPushAt && Date.now() - meta.testPushAt < 5 * 60 * 1000) {
    return { title: 'Notifications work ✅', body: 'You’ll get a reminder like this before your bills are due.' };
  }
  if (await hasRequest(meta)) return { title: '📨 YC asks for a copy of your data', body: 'Tap to approve or decline.', tag: 'request' };
  const d = new Date();
  const today = Shared.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const rems = state && state.reminders ? Object.values(state.reminders) : [];
  const cur = state && state.settings && state.settings.currency ? state.settings.currency.value : 'RM';
  const list = Shared.billsNeedingAttention(rems, today);
  if (!list.length) return { title: 'YH Tracker', body: 'Tap to check your bills.' };
  if (list.length === 1) {
    const x = list[0];
    return { title: `🔔 ${x.rem.title} ${when(x.days)}`, body: (x.rem.amount ? money(x.rem.amount, cur) + ' · ' : '') + 'Tap to mark it as paid.' };
  }
  return {
    title: `🔔 ${list.length} bills need attention`,
    body: list.slice(0, 4).map((x) => `${x.rem.title} (${when(x.days)})`).join(', ') + (list.length > 4 ? '…' : ''),
    count: list.length,
  };
}

self.addEventListener('push', (e) => {
  e.waitUntil(reminderText().then((m) => {
    const shown = self.registration.showNotification(m.title, {
      body: m.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: m.tag || 'bills', renotify: true, data: { go: m.tag === 'request' ? 'home' : 'bills' },
    });
    if (self.navigator.setAppBadge && m.count) self.navigator.setAppBadge(m.count).catch(() => {});
    return shown;
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.go) || 'bills';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      c.postMessage({ go });
      return c.focus();
    }
    return self.clients.openWindow('./#' + go);
  }));
});
