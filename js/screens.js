// The app's screens. Each returns HTML for #view; main.js decides which one shows.
'use strict';

// What's on screen: route + the month and filters the screens share.
const view = { route: 'home', arg: '', month: thisMonth(), recType: 'all', recAcc: '', recCat: '', recQuery: '', catKind: 'expense', showDone: false };

const ACCOUNT_TYPES = [['bank', '🏦', 'Bank'], ['savings', '🐷', 'Savings'], ['ewallet', '📱', 'E-wallet'], ['cash', '💵', 'Cash'], ['card', '💳', 'Credit card']];
const accIcon = (a) => (ACCOUNT_TYPES.find((t) => t[0] === (a && a.type)) || ACCOUNT_TYPES[0])[1];
const ACC_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

function screenHead(title, opts) {
  opts = opts || {};
  return `<header class="top">${opts.back ? `<button class="icon-btn" data-a="go" data-to="${opts.back}" aria-label="Back">${icon('back')}</button>` : ''}
    <div class="grow">${opts.sub ? `<div class="sub">${opts.sub}</div>` : ''}<h1 class="ellipsis">${title}</h1></div>${opts.right || ''}</header>`;
}

function txTitle(t) {
  if (t.type === 'transfer') return ['🔁', `${esc((acc(t.accountId) || {}).name || '?')} → ${esc((acc(t.toAccountId) || {}).name || '?')}`];
  if (t.type === 'adjust') return ['⚖️', 'Balance correction'];
  const c = cat(t.categoryId);
  return [c ? esc(c.icon) : '❔', c ? esc(c.name) : 'No category'];
}

// One transaction row. With accId, the amount is shown as it affected that account.
function txRow(t, opts) {
  opts = opts || {};
  const [emoji, title] = txTitle(t);
  const meta = [t.note && t.type !== 'adjust' ? esc(t.note) : '', t.type !== 'transfer' ? esc((acc(t.accountId) || {}).name || '') : '', opts.date ? fmtDay(t.date) : '']
    .filter(Boolean).join(' · ');
  let v = Number(t.amount);
  let cls = '';
  if (opts.accId) v = effect(t, opts.accId) / 100;
  else if (t.type === 'expense') v = -v;
  else if (t.type === 'transfer') cls = 'muted';
  if (v > 0 && t.type !== 'transfer' && !opts.accId) cls = 'pos';
  if (opts.accId && v > 0) cls = 'pos';
  return `<button class="item" data-a="edit-tx" data-id="${t.id}"><span class="bubble">${emoji}</span>
    <span class="grow"><div class="title ellipsis">${title}</div>${meta ? `<div class="meta ellipsis">${meta}</div>` : ''}
    ${opts.running !== undefined ? `<div class="meta">Balance ${money(opts.running)}</div>` : ''}</span>
    <span class="amt num ${cls}">${t.type === 'transfer' && !opts.accId ? money(v) : money(v, { plus: true })}</span></button>`;
}

function billRow(r) {
  const st = Shared.billStatus(r, today());
  const c = cat(r.categoryId);
  const label = { overdue: 'Overdue ' + -st.days + (st.days === -1 ? ' day' : ' days'), today: 'Due today', soon: 'Due ' + Shared.relDays(st.days), later: fmtDate(r.due) }[st.key];
  return `<div class="item tap" data-a="bill-edit" data-id="${r.id}"><span class="bubble">${c ? esc(c.icon) : '🔔'}</span>
    <span class="grow"><div class="title ellipsis">${esc(r.title)}</div>
    <div class="meta">${r.amount ? money(r.amount) + ' · ' : ''}${Shared.REPEATS[r.repeat] ? Shared.REPEATS[r.repeat].label : ''}</div>
    <div style="margin-top:4px"><span class="badge ${st.key}">${label}</span></div></span>
    <button class="btn sm primary" data-a="bill-pay" data-id="${r.id}">Pay</button></div>`;
}

// ============================== home ==============================
function homeScreen() {
  const name = setting('name') || 'YH';
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const mt = monthTotals(thisMonth());
  const accs = accounts();
  const bal = balances();
  const attn = billsAttention();
  let out = screenHead(`${hello}, ${esc(name)}`, { sub: fmtDate(today(), true), right: `<button class="icon-btn" data-a="go" data-to="settings" aria-label="Settings">${icon('settings')}</button>` });

  if (!syncState.online && unsentCount()) out += `<div class="banner warn"><p>📡 You’re offline. ${unsentCount()} change(s) are saved on this phone and will upload when you’re back online.</p></div>`;

  out += `<section class="hero"><div class="label">Total balance</div><div class="big num">${money(totalBalance())}</div>
    <div class="split"><div class="pill"><span class="small">In this month</span><b class="num">${money(mt.income)}</b></div>
    <div class="pill"><span class="small">Spent this month</span><b class="num">${money(mt.expense)}</b></div></div></section>`;

  if (!accs.length) {
    out += `<section class="card stack" style="text-align:center"><span style="font-size:44px">🏦</span><h2>Add your bank accounts</h2>
      <p class="muted">Add each bank, e-wallet and your cash. Then every income and expense goes into the right one.</p>
      <button class="btn primary block" data-a="acc-new">＋ Add an account</button></section>`;
  } else {
    out += `<section><div class="card-head"><h2>Accounts</h2><button class="link" data-a="go" data-to="reports">Report</button></div><div class="hscroll">` +
      accs.map((a) => `<button class="acc-card" data-a="go" data-to="account" data-id="${a.id}">
        <span class="row"><span class="dot" style="background:${esc(a.color || ACC_COLORS[0])}"></span><span class="name ellipsis">${accIcon(a)} ${esc(a.name)}</span></span>
        <span class="bal num ${bal[a.id] < 0 ? 'neg' : ''}">${money(bal[a.id])}</span></button>`).join('') +
      `<button class="acc-card add" data-a="acc-new">＋ Add</button></div></section>`;
  }

  if (attn.length) {
    out += `<section class="card flush"><div class="card-head"><h2>Bills to pay</h2><button class="link" data-a="go" data-to="bills">All bills</button></div>` +
      attn.slice(0, 3).map((x) => billRow(x.rem)).join('') + '</section>';
  }

  const budgeted = categories('expense').filter((c) => c.budget > 0).map((c) => ({ c, b: budgetOf(c, thisMonth()) }))
    .sort((x, y) => y.b.pct - x.b.pct).slice(0, 3);
  if (budgeted.length) {
    out += `<section class="card"><div class="card-head"><h2>Budget</h2><button class="link" data-a="go" data-to="budget">See all</button></div><div class="stack">` +
      budgeted.map(({ c, b }) => `<div><div class="spread" style="margin-bottom:6px"><span class="ellipsis">${esc(c.icon)} ${esc(c.name)}</span>${budgetStatus(b)}</div>${meter(b)}</div>`).join('') +
      '</div></section>';
  }

  const recent = txSorted().slice(0, 6);
  out += `<section class="card flush"><div class="card-head"><h2>Recent</h2>${recent.length ? '<button class="link" data-a="go" data-to="records">See all</button>' : ''}</div>` +
    (recent.length ? recent.map((t) => txRow(t, { date: true })).join('')
      : `<div class="empty"><span class="e">🧾</span>Nothing recorded yet.<br>Tap the green ＋ to add income or an expense.</div>`) + '</section>';
  return out;
}

// ============================== records ==============================
function recordsScreen() {
  let out = screenHead('Records', { back: 'home' }) + monthSwitch(view.month, 'month');
  const types = [['all', 'All'], ['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Transfers']];
  out += `<div class="chips scroll">${types.map(([v, l]) => `<button class="chip ${view.recType === v ? 'on' : ''}" data-a="rec-type" data-v="${v}">${l}</button>`).join('')}
    ${accounts(true).map((a) => `<button class="chip ${view.recAcc === a.id ? 'on' : ''}" data-a="rec-acc" data-v="${a.id}">${accIcon(a)} ${esc(a.name)}</button>`).join('')}</div>`;
  if (view.recCat) {
    const c = cat(view.recCat);
    out += `<div class="chips"><button class="chip on" data-a="rec-cat" data-v="">${c ? esc(c.icon) + ' ' + esc(c.name) : 'Category'} ✕</button></div>`;
  }
  out += `<label class="row card" style="padding:4px 14px">${icon('search')}<input id="rec-q" class="input" style="border:0;padding:0" placeholder="Search notes or categories" value="${esc(view.recQuery)}" data-input="rec-search" type="search" enterkeyhint="search"></label>`;
  return out + `<div id="rec-list">${recordsList()}</div>`;
}

function recordsList() {
  const q = view.recQuery.trim().toLowerCase();
  const list = txInMonth(view.month).filter((t) => {
    if (view.recType !== 'all' && t.type !== view.recType && !(view.recType === 'transfer' && t.type === 'adjust')) return false;
    if (view.recAcc && t.accountId !== view.recAcc && t.toAccountId !== view.recAcc) return false;
    if (view.recCat && t.categoryId !== view.recCat) return false;
    if (q) {
      const c = cat(t.categoryId);
      const hay = [t.note, c && c.name, (acc(t.accountId) || {}).name, (acc(t.toAccountId) || {}).name, String(t.amount)].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  if (!list.length) return `<section class="card"><div class="empty"><span class="e">🔍</span>No records for ${fmtMonth(view.month)}${view.recType !== 'all' || view.recAcc || view.recCat || q ? ' with these filters' : ''}.</div></section>`;
  let inc = 0;
  let exp = 0;
  list.forEach((t) => { if (t.type === 'income') inc += cents(t.amount); if (t.type === 'expense') exp += cents(t.amount); });
  let out = `<div class="figures" style="margin:0 0 16px"><div><span class="small muted">In</span><b class="num">${money(inc / 100)}</b></div>
    <div><span class="small muted">Out</span><b class="num">${money(exp / 100)}</b></div><div><span class="small muted">Net</span><b class="num">${money((inc - exp) / 100, { plus: true })}</b></div></div>`;
  out += '<section class="card flush">';
  let day = '';
  list.forEach((t) => {
    if (t.date !== day) {
      day = t.date;
      const net = list.filter((x) => x.date === day).reduce((s, x) => s + (x.type === 'income' ? cents(x.amount) : x.type === 'expense' ? -cents(x.amount) : 0), 0);
      out += `<div class="day-head"><span>${fmtDay(day)}</span><span class="num">${net ? money(net / 100, { plus: true }) : ''}</span></div>`;
    }
    out += txRow(t, view.recAcc ? { accId: view.recAcc } : {});
  });
  return out + '</section>';
}

// ============================== reports ==============================
function reportsScreen() {
  const ym = view.month;
  const isNow = ym === thisMonth();
  const end = isNow ? '' : monthEnd(ym);
  const bal = balances(end);
  const accs = accounts();
  let out = screenHead('Reports') + monthSwitch(ym, 'month');

  // Bank balances
  out += `<section class="card flush"><div class="card-head"><h2>Bank balances</h2><span class="muted small">${isNow ? 'now' : 'on ' + fmtDate(end)}</span></div>`;
  if (!accs.length) out += `<div class="empty">No accounts yet. <button class="link" data-a="acc-new">Add one</button></div>`;
  accs.forEach((a) => {
    const m = monthTotals(ym, a.id);
    out += `<button class="item" data-a="go" data-to="account" data-id="${a.id}"><span class="bubble">${accIcon(a)}</span>
      <span class="grow"><div class="row"><span class="dot" style="background:${esc(a.color || ACC_COLORS[0])}"></span><span class="title ellipsis">${esc(a.name)}</span></div>
      <div class="meta">${fmtMonthShort(ym)}: in ${money(m.moneyIn)}<br>out ${money(m.moneyOut)}</div></span>
      <span class="amt num ${bal[a.id] < 0 ? 'neg' : ''}">${money(bal[a.id])}</span></button>`;
  });
  if (accs.length > 1) out += `<div class="item"><span class="bubble">Σ</span><span class="grow title">Total</span><span class="amt num">${money(totalBalance(end))}</span></div>`;
  out += '</section>';

  // Income vs spending, 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(ym, -i));
  const mt = monthTotals(ym);
  out += `<section class="card"><div class="card-head"><h2>Income vs spending</h2></div>
    ${columnsChart(months.map((m) => { const t = monthTotals(m); return { label: fmtMonthShort(m), income: t.income, expense: t.expense, current: m === ym,
      tip: `${fmtMonthShort(m)}: in ${money(t.income)} · out ${money(t.expense)}` }; }))}
    <div class="figures"><div><span class="small muted">Income</span><b class="num">${money(mt.income)}</b></div>
    <div><span class="small muted">Spending</span><b class="num">${money(mt.expense)}</b></div>
    <div><span class="small muted">Saved</span><b class="num ${mt.net < 0 ? 'neg' : ''}">${money(mt.net, { plus: true })}</b></div></div></section>`;

  out += categoryReport(ym, 'expense', 'Spending by category');
  out += categoryReport(ym, 'income', 'Income by category');
  return out;
}

function categoryReport(ym, kind, title) {
  const by = byCategory(ym, kind);
  const total = Object.values(by).reduce((s, v) => s + v, 0);
  const rows = Object.keys(by).map((id) => {
    const c = cat(id);
    return { label: c ? `${esc(c.icon)} ${esc(c.name)}` : '❔ No category', value: by[id], sub: Math.round((by[id] / total) * 100) + '%',
      attrs: `data-a="cat-records" data-id="${esc(id)}"` };
  }).sort((a, b) => b.value - a.value);
  return `<section class="card"><div class="card-head"><h2>${title}</h2><span class="num small muted">${money(total)}</span></div>
    ${rows.length ? rankBars(rows, kind === 'income' ? 'income' : '') : `<div class="empty">Nothing in ${fmtMonth(ym)}.</div>`}</section>`;
}

// ============================== one account ==============================
function accountScreen(id) {
  const a = acc(id);
  if (!a || a.deleted) return screenHead('Account', { back: 'reports' }) + '<div class="empty">This account was deleted.</div>';
  const ym = view.month;
  const isNow = ym === thisMonth();
  const startBal = balances(Shared.addDays(ym + '-01', -1))[id] || 0;
  const list = txInMonth(ym).filter((t) => t.accountId === id || t.toAccountId === id);
  const m = monthTotals(ym, id);
  let out = screenHead(`${accIcon(a)} ${esc(a.name)}`, { back: 'reports', right: `<button class="icon-btn" data-a="acc-edit" data-id="${id}" aria-label="Edit account">${icon('edit')}</button>` });
  out += `<section class="hero"><div class="label">${isNow ? 'Balance now' : 'Balance on ' + fmtDate(monthEnd(ym))}</div>
    <div class="big num">${money(balances(isNow ? '' : monthEnd(ym))[id])}</div>
    <div class="split"><div class="pill"><span class="small">Money in</span><b class="num">${money(m.moneyIn)}</b></div>
    <div class="pill"><span class="small">Money out</span><b class="num">${money(m.moneyOut)}</b></div></div></section>`;
  out += monthSwitch(ym, 'month');

  // Balance at the end of each day of the month (up to today).
  const days = isNow ? +today().slice(8) : Shared.daysInMonth(+ym.slice(0, 4), +ym.slice(5));
  const byDay = {};
  list.forEach((t) => { byDay[t.date] = (byDay[t.date] || 0) + effect(t, id); });
  let run = cents(startBal);
  const pts = [];
  for (let d = 1; d <= days; d++) {
    const ds = ym + '-' + Shared.pad(d);
    run += byDay[ds] || 0;
    pts.push({ label: String(d), value: run / 100, tip: `${d} ${fmtMonthShort(ym)}: ${money(run / 100)}` });
  }
  if (pts.length) out += `<section class="card"><div class="card-head"><h2>Balance this month</h2></div>${lineChart(pts.length === 1 ? [{ label: '', value: startBal, tip: money(startBal) }].concat(pts) : pts, days > 20 ? 7 : days > 10 ? 3 : 1)}</section>`;

  out += `<div class="row"><button class="btn grow" data-a="acc-adjust" data-id="${id}">⚖️ Fix balance</button>
    <button class="btn grow" data-a="add" data-acc="${id}">＋ Add record</button></div>`;

  // Newest first, each with the balance right after it.
  const asc = list.slice().reverse();
  let r = cents(startBal);
  const after = {};
  asc.forEach((t) => { r += effect(t, id); after[t.id] = r / 100; });
  out += '<section class="card flush">' + (list.length ? list.map((t) => txRow(t, { accId: id, date: true, running: after[t.id] })).join('')
    : `<div class="empty">No records in ${fmtMonth(ym)}.</div>`) + '</section>';
  return out;
}

// ============================== budget ==============================
function budgetScreen() {
  const ym = view.month;
  const cats = categories('expense');
  const withB = cats.filter((c) => c.budget > 0).map((c) => ({ c, b: budgetOf(c, ym) })).sort((x, y) => y.b.pct - x.b.pct);
  const spentOther = byCategory(ym, 'expense');
  let out = screenHead('Budget', { right: `<button class="icon-btn" data-a="go" data-to="categories" aria-label="Categories">${icon('list')}</button>` }) + monthSwitch(ym, 'month');

  if (withB.length) {
    const total = withB.reduce((s, x) => s + cents(x.b.budget), 0) / 100;
    const spent = withB.reduce((s, x) => s + cents(x.b.spent), 0) / 100;
    const all = { spent, budget: total, left: Calc.round2(total - spent), pct: spent / total };
    all.level = all.pct > 1 ? 'over' : all.pct >= 0.8 ? 'warn' : 'ok';
    let perDay = '';
    if (ym === thisMonth() && all.left > 0) {
      const daysLeft = Shared.daysInMonth(+ym.slice(0, 4), +ym.slice(5)) - +today().slice(8) + 1;
      perDay = `<p class="muted small" style="margin-top:10px">You can spend about <b>${money(all.left / daysLeft)}</b> a day for the next ${daysLeft} day${daysLeft > 1 ? 's' : ''}.</p>`;
    }
    out += `<section class="card"><div class="spread"><div><div class="muted small">Spent of budget</div><div style="font-size:24px;font-weight:750" class="num">${money(spent)}
      <span class="muted" style="font-size:16px;font-weight:500">/ ${money(total)}</span></div></div>${budgetStatus(all)}</div>
      <div style="margin-top:10px">${meter(all)}</div>${perDay}</section>`;
    out += '<section class="card flush">' + withB.map(({ c, b }) => `<button class="item" data-a="set-budget" data-id="${c.id}"><span class="bubble">${esc(c.icon)}</span>
      <span class="grow"><div class="spread"><span class="title ellipsis">${esc(c.name)}</span>${budgetStatus(b)}</div>
      <div class="meta num" style="margin:2px 0 6px">${money(b.spent)} of ${money(b.budget)}</div>${meter(b)}</span></button>`).join('') + '</section>';
  } else {
    out += `<section class="card"><div class="empty"><span class="e">🎯</span>Set a monthly budget for a category,<br>and see how much is left as you spend.</div></section>`;
  }

  const rest = cats.filter((c) => !(c.budget > 0));
  if (rest.length) {
    out += `<section class="card flush"><div class="card-head"><h2>No budget yet</h2></div>` + rest.map((c) => `<button class="item" data-a="set-budget" data-id="${c.id}">
      <span class="bubble">${esc(c.icon)}</span><span class="grow"><div class="title ellipsis">${esc(c.name)}</div>
      ${spentOther[c.id] ? `<div class="meta num">Spent ${money(spentOther[c.id])}</div>` : ''}</span><span class="link">Set</span></button>`).join('') + '</section>';
  }
  return out;
}

// ============================== bills ==============================
function pushBanner() {
  const st = pushState();
  if (st === 'on') {
    return `<div class="banner"><div class="spread"><p>🔔 Notifications are on</p><button class="btn sm" data-a="push-test">Send a test</button></div></div>`;
  }
  const text = {
    install: '🔔 To get bill notifications, open YH Tracker from your Home Screen (Share ▸ Add to Home Screen).',
    unsupported: '🔔 This phone can’t show notifications from this app. Updating to iOS 16.4 or later fixes it.',
    denied: '🔕 Notifications are blocked. Open iPhone Settings ▸ Notifications ▸ YH Tracker and turn on Allow Notifications.',
    default: '🔔 Get a notification on your phone before each bill is due.',
  }[st];
  return `<div class="banner ${st === 'denied' ? 'warn' : ''}"><p>${text}</p>${st === 'default' ? '<button class="btn primary block" data-a="push-on">Turn on notifications</button>' : ''}</div>`;
}

function billsScreen() {
  const t = today();
  const all = reminders();
  const active = all.filter((r) => r.active);
  const groups = { overdue: [], soon: [], later: [] };
  active.forEach((r) => {
    const st = Shared.billStatus(r, t);
    (st.key === 'overdue' ? groups.overdue : st.key === 'later' && st.days > 7 ? groups.later : groups.soon).push(r);
  });
  const done = all.filter((r) => !r.active);
  let out = screenHead('Bills', { right: `<button class="icon-btn" data-a="bill-new" aria-label="Add a bill">${icon('plus')}</button>` }) + pushBanner();
  if (!all.length) {
    return out + `<section class="card stack" style="text-align:center"><span style="font-size:44px">🗓️</span><h2>Never miss a payment</h2>
      <p class="muted">Add rent, phone, loans, insurance… choose when it’s due and when to remind you.</p>
      <button class="btn primary block" data-a="bill-new">＋ Add a bill</button></section>`;
  }
  const sec = (title, list) => (list.length ? `<section class="card flush"><div class="card-head"><h2>${title}</h2></div>${list.map(billRow).join('')}</section>` : '');
  out += sec('Overdue', groups.overdue) + sec('Due soon', groups.soon) + sec('Later', groups.later);
  if (!active.length) out += '<section class="card"><div class="empty">All paid 🎉</div></section>';
  if (done.length) {
    out += `<button class="link" data-a="toggle-done">${view.showDone ? 'Hide' : 'Show'} finished one-time bills (${done.length})</button>`;
    if (view.showDone) {
      out += '<section class="card flush">' + done.map((r) => `<button class="item" data-a="bill-edit" data-id="${r.id}"><span class="bubble">✅</span>
        <span class="grow"><div class="title ellipsis">${esc(r.title)}</div><div class="meta">Paid ${r.lastPaid ? fmtDate(r.lastPaid) : ''}</div></span>
        <span class="amt num muted">${r.amount ? money(r.amount) : ''}</span></button>`).join('') + '</section>';
    }
  }
  return out;
}

// ============================== settings ==============================
function ago(ms) {
  if (!ms) return 'never';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
}

function settingsScreen() {
  const waiting = unsentCount();
  const ps = pushState();
  const link = (to, emoji, title, meta) => `<button class="item" data-a="go" data-to="${to}"><span class="bubble">${emoji}</span>
    <span class="grow"><div class="title">${title}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</span>${icon('next')}</button>`;
  return screenHead('Settings', { back: 'home' }) +
    `<section class="card"><label class="field"><span>Your name</span><input class="input" maxlength="30" value="${esc(setting('name'))}" data-change="set-name" autocomplete="given-name"></label></section>
    <section class="card flush">${link('accounts', '🏦', 'Bank accounts', accounts().length + ' account' + (accounts().length === 1 ? '' : 's'))}
    ${link('categories', '🏷️', 'Categories & budgets', '')}${link('bills', '🔔', 'Bills & notifications', ps === 'on' ? 'Notifications on' : 'Notifications off')}</section>
    <section class="card flush">
      <div class="item"><span class="bubble">🔒</span><span class="grow"><div class="title">App lock</div><div class="meta">Ask for a 4-digit PIN when opening the app</div></span>
        <label class="switch"><input type="checkbox" data-change="pin-toggle" ${M.pinHash ? 'checked' : ''} aria-label="App lock"><i></i></label></div>
      <div class="item"><span class="bubble">☁️</span><span class="grow"><div class="title">Backup to Google Sheet</div>
        <div class="meta">${syncState.error && waiting ? esc(syncState.error) : waiting ? waiting + ' change(s) waiting to upload' : 'Backed up ' + ago(M.lastSync)}</div></span>
        <button class="btn sm" data-a="sync-now">${icon('sync')}</button></div>
      <button class="item" data-a="export"><span class="bubble">📤</span><span class="grow"><div class="title">Export to a spreadsheet file</div><div class="meta">All records as CSV</div></span>${icon('download')}</button>
    </section>
    <section class="card flush"><button class="item" data-a="unpair"><span class="bubble">📵</span><span class="grow"><div class="title" style="color:var(--bad)">Unpair this phone</div>
      <div class="meta">Removes the data from this phone. Your Google Sheet keeps everything.</div></span></button></section>
    <p class="muted tiny" style="text-align:center">YH Tracker · version ${esc(CFG.build || 'dev')}</p>`;
}

function accountsScreen() {
  const bal = balances();
  const all = accounts(true);
  return screenHead('Bank accounts', { back: 'settings', right: `<button class="icon-btn" data-a="acc-new" aria-label="Add account">${icon('plus')}</button>` }) +
    '<section class="card flush">' + (all.length ? all.map((a, i) => `<div class="item"><span class="bubble">${accIcon(a)}</span>
      <button class="grow" style="border:0;background:none;text-align:left;padding:0" data-a="acc-edit" data-id="${a.id}"><div class="title ellipsis">${esc(a.name)}${a.archived ? ' <span class="muted small">(hidden)</span>' : ''}</div>
      <div class="meta num">${money(bal[a.id])}</div></button>
      <button class="icon-btn plain" data-a="acc-move" data-id="${a.id}" data-d="-1" aria-label="Move up" ${i === 0 ? 'disabled style="opacity:.25"' : ''}><svg class="i" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg></button></div>`).join('')
      : '<div class="empty">No accounts yet.</div>') + '</section>' +
    '<p class="muted small" style="text-align:center">Tap an account to rename it, change its starting balance, or hide it.</p>';
}

function categoriesScreen() {
  const list = live('categories').filter((c) => c.kind === view.catKind).sort((a, b) => (a.archived - b.archived) || (a.order || 0) - (b.order || 0));
  return screenHead('Categories', { back: 'settings', right: `<button class="icon-btn" data-a="cat-new" aria-label="Add category">${icon('plus')}</button>` }) +
    `<div class="seg"><button class="${view.catKind === 'expense' ? 'on' : ''}" data-a="cat-kind" data-v="expense">Spending</button>
      <button class="${view.catKind === 'income' ? 'on' : ''}" data-a="cat-kind" data-v="income">Income</button></div>` +
    '<section class="card flush">' + list.map((c) => `<button class="item" data-a="cat-edit" data-id="${c.id}"><span class="bubble">${esc(c.icon)}</span>
      <span class="grow"><div class="title ellipsis">${esc(c.name)}${c.archived ? ' <span class="muted small">(hidden)</span>' : ''}</div>
      ${c.kind === 'expense' ? `<div class="meta num">${c.budget > 0 ? 'Budget ' + money(c.budget) + ' a month' : 'No budget'}</div>` : ''}</span>${icon('next')}</button>`).join('') + '</section>';
}

const SCREENS = {
  home: homeScreen, records: recordsScreen, reports: reportsScreen, account: accountScreen, budget: budgetScreen,
  bills: billsScreen, settings: settingsScreen, accounts: accountsScreen, categories: categoriesScreen,
};
const TAB_OF = { home: 'home', records: 'home', settings: 'home', accounts: 'home', categories: 'budget', reports: 'reports', account: 'reports', budget: 'budget', bills: 'bills' };
