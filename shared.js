// Pure date and reminder logic, used by both the server (Apps Script) and the phone app.
// The build copies this file into the app as shared.js, so keep it plain ES2017 with no Apps Script calls.
var Shared = (function () {
  'use strict';

  // How each "repeat" choice moves a bill's due date forward.
  var REPEATS = {
    none: { label: 'One time', unit: 'none', every: 0 },
    week: { label: 'Every week', unit: 'day', every: 7 },
    '2week': { label: 'Every 2 weeks', unit: 'day', every: 14 },
    month: { label: 'Every month', unit: 'month', every: 1 },
    '3month': { label: 'Every 3 months', unit: 'month', every: 3 },
    '6month': { label: 'Every 6 months', unit: 'month', every: 6 },
    year: { label: 'Every year', unit: 'month', every: 12 },
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // 'YYYY-MM-DD' for a calendar date; overflow (e.g. day 32) rolls into the next month.
  function ymd(y, m, d) {
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }

  function parts(s) {
    var p = String(s).split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function addDays(s, n) {
    var p = parts(s);
    return ymd(p.y, p.m, p.d + n);
  }

  // Whole days from a to b (b - a).
  function daysBetween(a, b) {
    var pa = parts(a);
    var pb = parts(b);
    return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
  }

  // Adds months, keeping the bill on its usual day (anchorDay), or the month's last day when it's shorter.
  function addMonths(s, n, anchorDay) {
    var p = parts(s);
    var total = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(total / 12);
    var m = (total % 12) + 1;
    return ymd(y, m, Math.min(anchorDay || p.d, daysInMonth(y, m)));
  }

  // The due date after this one, or '' for a one-time bill.
  function nextDue(rem) {
    var r = REPEATS[rem.repeat] || REPEATS.none;
    if (r.unit === 'day') return addDays(rem.due, r.every);
    if (r.unit === 'month') return addMonths(rem.due, r.every, rem.day || parts(rem.due).d);
    return '';
  }

  // When to notify for a bill's current due date, in the phone's local time: 'YYYY-MM-DD HH:mm'.
  // lead = the "remind me N days before" alert, due = on the day, late = the day after if still unpaid.
  function notifyMoments(rem) {
    if (!rem || !rem.active || rem.deleted || !isDate(rem.due)) return [];
    var time = /^\d{2}:\d{2}$/.test(rem.time || '') ? rem.time : '09:00';
    var before = Math.max(0, Math.min(60, Math.floor(Number(rem.before) || 0)));
    var list = [];
    if (before > 0) list.push({ stage: 'lead', at: addDays(rem.due, -before) + ' ' + time });
    list.push({ stage: 'due', at: rem.due + ' ' + time });
    list.push({ stage: 'late', at: addDays(rem.due, 1) + ' ' + time });
    return list;
  }

  // Where a bill stands on `today`: overdue, due today, soon (inside its reminder window), or later.
  function billStatus(rem, today) {
    var days = daysBetween(today, rem.due);
    var before = Math.max(0, Number(rem.before) || 0);
    if (days < 0) return { key: 'overdue', days: days };
    if (days === 0) return { key: 'today', days: 0 };
    if (days <= Math.max(before, 3)) return { key: 'soon', days: days };
    return { key: 'later', days: days };
  }

  // "today", "tomorrow", "in 5 days", "3 days ago".
  function relDays(days) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    return days > 0 ? 'in ' + days + ' days' : -days + ' days ago';
  }

  // Bills that deserve a notification right now (used by the phone when a reminder push arrives).
  function billsNeedingAttention(reminders, today) {
    var out = [];
    reminders.forEach(function (r) {
      if (!r || r.deleted || !r.active || !isDate(r.due)) return;
      var days = daysBetween(today, r.due);
      var before = Math.max(0, Number(r.before) || 0);
      if (days <= before) out.push({ rem: r, days: days });
    });
    out.sort(function (a, b) { return a.days - b.days; });
    return out;
  }

  function money(v, cur) {
    return (cur || 'RM') + ' ' + Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function dueWords(days) {
    if (days < 0) return 'overdue ' + -days + (days === -1 ? ' day' : ' days');
    return 'due ' + relDays(days);
  }

  // The notification for the bills open on `today`: {title, body, count}, or null if none are.
  function billNotice(reminders, today, cur) {
    var list = billsNeedingAttention(reminders, today);
    if (!list.length) return null;
    if (list.length === 1) {
      var x = list[0];
      return { title: '🔔 ' + x.rem.title + ' ' + dueWords(x.days), body: (x.rem.amount ? money(x.rem.amount, cur) + ' · ' : '') + 'Tap to mark it as paid.', count: 1 };
    }
    return {
      title: '🔔 ' + list.length + ' bills need attention',
      body: list.slice(0, 4).map(function (b) { return b.rem.title + ' (' + dueWords(b.days) + ')'; }).join(', ') + (list.length > 4 ? '…' : ''),
      count: list.length,
    };
  }

  return {
    REPEATS: REPEATS,
    pad: pad,
    ymd: ymd,
    isDate: isDate,
    addDays: addDays,
    addMonths: addMonths,
    daysBetween: daysBetween,
    daysInMonth: daysInMonth,
    nextDue: nextDue,
    notifyMoments: notifyMoments,
    billStatus: billStatus,
    billsNeedingAttention: billsNeedingAttention,
    billNotice: billNotice,
    relDays: relDays,
  };
})();
