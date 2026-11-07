// The Android app shows this same page in a WebView and adds the MyTrackerApp bridge (android-app/MainActivity.java).
// A WebView has no Web Push, so here the page hands Android its reminders instead. In a browser Native is null
// and nothing in this file runs.
'use strict';

const Native = window.MyTrackerApp || null;
let nativeTold = '';

// Every reminder ahead, with its words worked out now: Android shows them at their time, even offline.
function nativeAlerts() {
  const rems = Object.values(S.reminders);
  const cur = setting('currency') || 'RM';
  const now = Date.now();
  const seen = new Set();
  const out = [];
  reminderSchedule().list.forEach((m) => {
    const [y, mo, d, h, mi] = m.at.split(/[- :]/).map(Number);
    const at = new Date(y, mo - 1, d, h, mi).getTime();
    if (at <= now || seen.has(at)) return; // two bills at one time: one notification names both
    const notice = Shared.billNotice(rems, m.at.slice(0, 10), cur);
    if (!notice) return;
    seen.add(at);
    out.push({ at, title: notice.title, body: notice.body });
  });
  return out;
}

// Called around every sync: the widget code, and the reminders while notifications are on.
function tellNative() {
  if (!Native || !M.token || CFG.demo) return;
  const w = widgetCfg();
  const code = w ? widgetCode(w) : '';
  const reminders = pushState() === 'on' ? JSON.stringify({ token: M.token, api: CFG.api, alerts: nativeAlerts() }) : '';
  const icon = Theme.nearest(Theme.read(setting('theme')).color);
  if (code + reminders + icon === nativeTold) return;
  nativeTold = code + reminders + icon;
  Native.setWidget(code);
  Native.setReminders(reminders);
  Native.setIcon(icon);
}

function nativeSignedOut() {
  if (!Native) return;
  nativeTold = '';
  Native.signedOut();
  Native.setIcon('Pistachio');
}

function nativeAskNotifications() {
  return new Promise((done) => {
    window.nativeAsked = done;
    Native.askNotifications();
  });
}

if (Native) {
  // A tap on a widget or a notification, with the app already open.
  window.nativeOpen = (route, request) => {
    if (!M.token) return;
    if (route === 'request') showRequestFromNotification(request);
    else location.hash = '#' + route;
  };

  // Android's Back: true if the page used it; false leaves the app.
  window.nativeBack = () => {
    if (topSheet()) { closeSheet(); return true; }
    if (!$('#cover').hidden) return false; // sign-in and lock screens
    const up = $('header.top [aria-label="Back"]');
    if (up) { up.click(); return true; }
    if (view.route === 'home') return false;
    go('home');
    return true;
  };
}
