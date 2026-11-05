// The app's screens. Each returns HTML for #view; main.js decides which one shows.
'use strict';

// What's on screen: route + the periods and filters the screens share.
const view = {
  route: 'home', arg: '', month: thisMonth(), year: +thisMonth().slice(0, 4),
  recMode: 'list', recDay: '', recType: 'all', recAcc: '', recCat: '', recQuery: '',
  statPeriod: 'month', statKind: 'expense', catKind: 'expense', catSort: false, showDone: false, showHidden: false,
};

// ============================== account kinds & providers ==============================
// debt: the balance is what's owed (shown and stored as a negative number).
const KINDS = {
  bank: { emoji: '🏦', label: 'Bank account', hint: 'Savings or current account', group: 'Bank accounts' },
  ewallet: { emoji: '📱', label: 'E-wallet', hint: 'Touch ’n Go, GrabPay, ShopeePay, Boost, MAE', group: 'E-wallets' },
  cash: { emoji: '💵', label: 'Cash', hint: 'Money in your purse', group: 'Cash' },
  savings: { emoji: '🐷', label: 'Savings & investments', hint: 'ASB, Tabung Haji, EPF, fixed deposit', group: 'Savings & investments' },
  prepaid: { emoji: '🎫', label: 'Prepaid card', hint: 'Touch ’n Go card, gift or member cards', group: 'Prepaid cards' },
  card: { emoji: '💳', label: 'Credit card', hint: 'Shows how much you owe', group: 'Cards & PayLater', debt: true },
  paylater: { emoji: '🧾', label: 'PayLater', hint: 'Atome, SPayLater, Grab PayLater', group: 'Cards & PayLater', debt: true },
  lent: { emoji: '🤝', label: 'Money lent', hint: 'Someone owes you', group: 'Money lent' },
  borrowed: { emoji: '🙏', label: 'Money borrowed', hint: 'You owe someone', group: 'Money borrowed', debt: true },
};
const KIND_ORDER = ['bank', 'ewallet', 'cash', 'savings', 'prepaid', 'card', 'paylater', 'lent', 'borrowed'];
const kindOf = (a) => KINDS[a && a.type] || KINDS.bank;
const isDebt = (a) => !!kindOf(a).debt;

// Banks and e-wallets: [name, colour, text colour, initials]. Each one has its logo in logos/<key>.png.
const PROVIDERS = {
  maybank: ['Maybank', '#FFC83D', '#1A1A1A', 'MB'], cimb: ['CIMB', '#D7141A', '#fff', 'C'], pbb: ['Public Bank', '#C8102E', '#fff', 'PB'],
  rhb: ['RHB', '#005DAA', '#fff', 'RHB'], hlb: ['Hong Leong', '#003A79', '#fff', 'HL'], ambank: ['AmBank', '#E31837', '#fff', 'Am'],
  bimb: ['Bank Islam', '#8E1F4F', '#fff', 'BI'], bsn: ['BSN', '#0A4DA2', '#fff', 'BSN'], uob: ['UOB', '#00337A', '#fff', 'UOB'],
  ocbc: ['OCBC', '#E2231A', '#fff', 'O'], hsbc: ['HSBC', '#DB0011', '#fff', 'H'], alliance: ['Alliance Bank', '#0083BE', '#fff', 'A'],
  affin: ['Affin Bank', '#00468B', '#fff', 'Af'], rakyat: ['Bank Rakyat', '#00599C', '#fff', 'BR'], muamalat: ['Bank Muamalat', '#6D2077', '#fff', 'BM'],
  agro: ['Agrobank', '#00843D', '#fff', 'Ag'], scb: ['Standard Chartered', '#0473EA', '#fff', 'SC'], gxbank: ['GXBank', '#5B2DE1', '#fff', 'GX'],
  aeon: ['AEON Bank', '#B6007A', '#fff', 'AE'], boostbank: ['Boost Bank', '#E1251B', '#fff', 'BB'], ryt: ['Ryt Bank', '#0000F1', '#fff', 'Ryt'],
  tng: ['Touch ’n Go eWallet', '#005BAA', '#fff', 'TNG'], grab: ['GrabPay', '#00B14F', '#fff', 'G'], shopee: ['ShopeePay', '#EE4D2D', '#fff', 'S'],
  boost: ['Boost', '#E1251B', '#fff', 'B'], mae: ['MAE', '#FFC83D', '#1A1A1A', 'MAE'], bigpay: ['BigPay', '#2A2A2A', '#fff', 'BP'], setel: ['Setel', '#00A19C', '#fff', 'Se'],
  asb: ['ASB', '#C8102E', '#fff', 'ASB'], th: ['Tabung Haji', '#00703C', '#fff', 'TH'], kwsp: ['EPF (KWSP)', '#003D7D', '#fff', 'EPF'],
  versa: ['Versa', '#6C4BF4', '#fff', 'V'], stashaway: ['StashAway', '#0B2A5B', '#fff', 'SA'], tngcard: ['Touch ’n Go card', '#005BAA', '#fff', 'TNG'],
  atome: ['Atome', '#F0FF5F', '#1A1A1A', 'At'], spaylater: ['SPayLater', '#EE4D2D', '#fff', 'SP'], grabpl: ['Grab PayLater', '#00B14F', '#fff', 'GP'],
};
const PROVIDERS_FOR = {
  bank: ['maybank', 'cimb', 'pbb', 'rhb', 'hlb', 'ambank', 'bimb', 'bsn', 'uob', 'ocbc', 'hsbc', 'alliance', 'affin', 'rakyat', 'muamalat', 'agro', 'scb', 'gxbank', 'aeon', 'boostbank', 'ryt'],
  card: ['maybank', 'cimb', 'pbb', 'rhb', 'hlb', 'ambank', 'uob', 'ocbc', 'hsbc', 'alliance', 'affin', 'bimb', 'scb', 'aeon'],
  ewallet: ['tng', 'grab', 'shopee', 'boost', 'mae', 'bigpay', 'setel'],
  savings: ['asb', 'th', 'kwsp', 'versa', 'stashaway', 'maybank', 'cimb', 'pbb', 'rhb', 'hlb'],
  prepaid: ['tngcard'],
  paylater: ['atome', 'spaylater', 'grabpl'],
};
const CARD_COLORS = ['#3E7D27', '#2a78d6', '#1baf7a', '#c98500', '#d55181', '#6250d6', '#e34948', '#eb6834', '#37474F', '#0B2A5B'];

// Text colour that reads on a card colour.
function inkOn(hex) {
  const n = parseInt(String(hex || '#3E7D27').slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#1A1A1A' : '#FFFFFF';
}

// Banks the user adds are settings 'bank:<id>' = { name, color, logo (small picture as a data: URL, or ''), kind }.
// A bank added as a bank account is offered for credit cards and savings too; others only for their own kind.
const isOwnProvider = (key) => /^bank:/.test(key || '');
const PICTURE_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter((w) => w && !/^(of|the|and|&)$/i.test(w));
  return (words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join('') : (words[0] || '?').slice(0, 3)).toUpperCase();
}
function provider(key) {
  if (!key) return null;
  const p = PROVIDERS[key];
  if (p) return { key, name: p[0], color: p[1], ink: p[2], initials: p[3], logo: `logos/${key}.png` };
  const c = isOwnProvider(key) && setting(key);
  if (!c || typeof c !== 'object') return null;
  const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : CARD_COLORS[0];
  return { key, name: String(c.name || ''), color, ink: inkOn(color), initials: initialsOf(c.name), logo: PICTURE_URL.test(c.logo || '') ? c.logo : '', kind: c.kind, own: true };
}
function ownProviders(kind) {
  return live('settings').filter((r) => isOwnProvider(r.id) && r.value && (r.value.kind === kind || (r.value.kind === 'bank' && (kind === 'card' || kind === 'savings'))))
    .map((r) => provider(r.id)).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name));
}

function accBadge(a, big) {
  const p = provider(a && a.provider);
  const cls = 'logo' + (big ? ' big' : '');
  if (p && p.logo) return `<span class="${cls} pic"><img src="${esc(p.logo)}" alt=""></span>`;
  if (p) return `<span class="${cls}" style="background:${p.color};color:${p.ink}"><span>${esc(p.initials)}</span></span>`;
  return `<span class="${cls} emoji">${kindOf(a).emoji}</span>`;
}

// An account as a bank card. In a stack only its top row shows, except for the last card.
function cardFace(a, bal, opts) {
  opts = opts || {};
  const color = a.color || (provider(a.provider) || {}).color || CARD_COLORS[0];
  const ink = inkOn(color);
  const owed = isDebt(a);
  const tags = [a.excluded ? 'Not in total' : '', a.archived ? 'Hidden' : ''].filter(Boolean);
  return `<${opts.tag || 'button'} class="wcard${opts.big ? ' big' : ''}" ${opts.tag ? '' : `data-a="go" data-to="account" data-id="${a.id}"`}
      style="--c:${esc(color)};color:${ink}">
    <span class="wtop">${accBadge(a)}<span class="grow"><span class="wname ellipsis">${esc(a.name)}</span><span class="wtype ellipsis">${kindOf(a).label}</span></span>
      <span class="wbal num">${owed && bal < 0 ? '<span class="wlabel">Owe</span>' : ''}${amt(owed ? Math.abs(bal) : bal)}</span></span>
    <span class="wbottom"><span class="ellipsis">${a.last4 ? '•••• ' + esc(a.last4) : esc(a.note || '')}</span>${tags.map((t) => `<span class="wtag">${t}</span>`).join('')}</span>
  </${opts.tag || 'button'}>`;
}

// ============================== shared pieces ==============================
function screenHead(title, opts) {
  opts = opts || {};
  return `<header class="top">${opts.back ? `<button class="icon-btn" data-a="go" data-to="${opts.back}" aria-label="Back">${icon('back')}</button>` : ''}
    <div class="grow">${opts.sub ? `<div class="sub ellipsis">${opts.sub}</div>` : ''}<h1 class="ellipsis">${title}</h1></div>${opts.right || ''}</header>`;
}
const eyeBtn = () => `<button class="icon-btn" data-a="privacy" aria-label="${M.hideAmounts ? 'Show amounts' : 'Hide amounts'}">${icon(M.hideAmounts ? 'eyeOff' : 'eye')}</button>`;

function txTitle(t) {
  if (t.type === 'transfer') return ['🔁', `${esc((acc(t.accountId) || {}).name || '?')} → ${esc((acc(t.toAccountId) || {}).name || '?')}`];
  if (t.type === 'adjust') return ['⚖️', 'Balance correction'];
  const c = cat(t.categoryId);
  return [c ? esc(c.icon) : '❔', c ? esc(c.name) : 'No category'];
}

// One record. With accId, the amount is shown as it changed that account.
function txRow(t, opts) {
  opts = opts || {};
  const [emoji, title] = txTitle(t);
  const meta = [t.note && t.type !== 'adjust' ? esc(t.note) : '', t.type !== 'transfer' ? esc((acc(t.accountId) || {}).name || '') : '', opts.date ? fmtDay(t.date) : '']
    .filter(Boolean).join(' · ');
  let v = Number(t.amount);
  let cls = '';
  if (opts.accId) { v = effect(t, opts.accId) / 100; cls = v > 0 ? 'pos' : ''; }
  else if (t.type === 'expense') v = -v;
  else if (t.type === 'transfer') cls = 'muted';
  else if (v > 0) cls = 'pos';
  return `<button class="item" data-a="edit-tx" data-id="${t.id}"><span class="bubble">${emoji}</span>
    <span class="grow"><span class="title ellipsis">${title}</span>${meta ? `<span class="meta ellipsis">${meta}</span>` : ''}
    ${opts.running !== undefined ? `<span class="meta ellipsis">Balance ${amt(opts.running)}</span>` : ''}</span>
    <span class="amt num ${cls}">${t.type === 'transfer' && !opts.accId ? amt(v) : amt(v, { plus: true })}</span></button>`;
}

// A day's records in one card, with the day's net and a button to add to that day.
function dayCard(date, list, opts) {
  const net = list.reduce((s, x) => s + (x.type === 'income' ? cents(x.amount) : x.type === 'expense' ? -cents(x.amount) : 0), 0);
  return `<section class="card flush"><div class="day-head"><span class="ellipsis"><b>${fmtDay(date)}</b></span>
      <button class="chip xs" data-a="add" data-date="${date}" aria-label="Add a record on ${fmtDate(date)}">＋ Add</button>
      <span class="grow"></span><span class="num muted">${net ? amt(net / 100, { plus: true }) : ''}</span></div>
    ${list.map((t) => txRow(t, opts)).join('')}</section>`;
}

function byDay(list) {
  const days = [];
  list.forEach((t) => {
    if (!days.length || days[days.length - 1][0] !== t.date) days.push([t.date, []]);
    days[days.length - 1][1].push(t);
  });
  return days;
}

function billRow(r) {
  const st = Shared.billStatus(r, today());
  const c = cat(r.categoryId);
  const label = { overdue: 'Overdue ' + -st.days + (st.days === -1 ? ' day' : ' days'), today: 'Due today', soon: 'Due ' + Shared.relDays(st.days), later: fmtDate(r.due) }[st.key];
  return `<div class="item tap" data-a="bill-edit" data-id="${r.id}"><span class="bubble">${c ? esc(c.icon) : '🔔'}</span>
    <span class="grow"><span class="title ellipsis">${esc(r.title)}</span>
    <span class="meta ellipsis">${r.amount ? amt(r.amount) + ' · ' : ''}${Shared.REPEATS[r.repeat] ? Shared.REPEATS[r.repeat].label : ''}${r.auto ? ' · Auto' : ''}</span>
    <span class="badges"><span class="badge ${st.key}">${label}</span></span></span>
    <button class="btn sm primary" data-a="bill-pay" data-id="${r.id}">Pay</button></div>`;
}

// Total monthly budget across categories that have one.
function budgetTotals(ym) {
  const list = categories('expense').filter((c) => c.budget > 0).map((c) => budgetOf(c, ym));
  const budget = list.reduce((s, b) => s + cents(b.budget), 0) / 100;
  const spent = list.reduce((s, b) => s + cents(b.spent), 0) / 100;
  const pct = budget ? spent / budget : 0;
  return { budget, spent, left: Calc.round2(budget - spent), pct, level: !budget ? 'none' : pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok' };
}

function perDayLeft(b, ym) {
  if (ym !== thisMonth() || b.left <= 0) return '';
  const daysLeft = Shared.daysInMonth(+ym.slice(0, 4), +ym.slice(5)) - +today().slice(8) + 1;
  return `About <b>${amt(b.left / daysLeft)}</b> a day for ${daysLeft} more day${daysLeft > 1 ? 's' : ''}`;
}

// ============================== home ==============================
function homeScreen() {
  const ym = thisMonth();
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const mt = monthTotals(ym);
  const prev = spentUpTo(shiftMonth(ym, -1), +today().slice(8));
  const bud = budgetTotals(ym);
  const attn = billsAttention();
  let out = screenHead(setting('name') ? `${hello}, ${esc(setting('name'))}` : hello, { sub: fmtDate(today(), true),
    right: eyeBtn() + `<button class="icon-btn" data-a="go" data-to="settings" aria-label="Settings">${icon('settings')}</button>` });

  if (CFG.demo) out += `<div class="banner"><p>🧪 <b>Preview with sample data.</b> Nothing here is saved to the cloud. <button class="link" data-a="demo-reset">Start over</button></p></div>`;
  if (!CFG.demo && !M.lastSync) out += `<div class="banner"><p>⏳ Getting your data from your online backup…</p></div>`;
  if (!CFG.demo && pushState() === 'default' && !M.pushNagOff) {
    out += `<div class="banner"><div class="row"><p class="grow">🔔 <b>Turn on notifications</b> for bill reminders and when YC asks for your data.</p>
      <button class="icon-btn plain" data-a="push-nag-off" aria-label="Not now">${icon('close')}</button></div>
      <button class="btn primary block" data-a="push-on">Turn on notifications</button></div>`;
  }
  if (pendingRequests().length) out += `<button class="banner tap-card" data-a="request-review"><p>📨 <b>YC asks for a copy of your data.</b> Tap to approve or decline.</p></button>`;
  if (!syncState.online && unsentCount()) out += `<div class="banner warn"><p>📡 You’re offline. ${unsentCount()} change(s) are saved on this phone and will upload when you’re back online.</p></div>`;

  let trend = '';
  if (prev > 0 && !M.hideAmounts) {
    const ch = (mt.expense - prev) / prev;
    trend = `<span class="trend">${ch > 0 ? '▲' : '▼'} ${Math.abs(Math.round(ch * 100))}% vs same time last month</span>`;
  }
  out += `<section class="hero"><div class="label">Spent in ${MONTHS_LONG[+ym.slice(5) - 1]}</div>
    <div class="big num">${amt(mt.expense)}</div>${trend}
    <div class="trio"><div><span>Income</span><b class="num">${amt(mt.income)}</b></div>
    <div><span>Net</span><b class="num">${amt(mt.net, { plus: true })}</b></div>
    <div><span>Budget left</span><b class="num">${bud.budget ? amt(bud.left) : '—'}</b></div></div></section>`;

  if (!accounts(true).length) {
    out += `<section class="card stack center-text"><span class="hero-emoji">🏦</span><h2>Add your accounts</h2>
      <p class="muted">Add each bank, e-wallet and your cash, so every record goes into the right one.</p>
      <button class="btn primary block" data-a="acc-new">＋ Add an account</button></section>`;
  }

  if (bud.budget) {
    out += `<button class="card tap-card" data-a="go" data-to="budget"><div class="spread"><h2>Monthly budget</h2>${budgetStatus(bud)}</div>
      <div class="meta num">${amt(bud.spent)} of ${amt(bud.budget)}</div>${meter(bud)}
      ${perDayLeft(bud, ym) ? `<p class="small muted">${perDayLeft(bud, ym)}</p>` : ''}</button>`;
  } else {
    out += `<button class="card tap-card row" data-a="go" data-to="budget"><span class="bubble">🎯</span><span class="grow"><b>Set a monthly budget</b>
      <span class="meta">See how much is left as you spend</span></span>${icon('next')}</button>`;
  }

  out += `<section class="card flush"><div class="card-head"><h2>Bills</h2><button class="link" data-a="go" data-to="bills">All bills</button></div>` +
    (attn.length ? attn.slice(0, 3).map((x) => billRow(x.rem)).join('')
      : `<button class="item" data-a="${reminders().length ? 'go' : 'bill-new'}" data-to="bills"><span class="bubble">✅</span><span class="grow"><span class="title">No bills due soon</span>
        <span class="meta">${reminders().length ? 'You’re all caught up' : 'Add rent, phone or loans to get reminded'}</span></span>${icon('next')}</button>`) + '</section>';

  const days = byDay(txSorted().slice(0, 12)).slice(0, 3);
  out += `<div class="section-head"><h2>Recent</h2>${days.length ? '<button class="link" data-a="go" data-to="records">See all</button>' : ''}</div>`;
  out += days.length ? days.map(([d, list]) => dayCard(d, list)).join('')
    : `<section class="card"><div class="empty"><span class="e">🧾</span>Nothing recorded yet.<br>Tap the green ＋ to add spending or income.</div></section>`;
  return out;
}

// ============================== records ==============================
function recordsScreen() {
  const mt = monthTotals(view.month);
  let out = screenHead('Records', { right: eyeBtn() }) + monthSwitch(view.month, 'month');
  out += `<div class="figures"><div><span>Spent</span><b class="num">${amt(mt.expense)}</b></div>
    <div><span>Income</span><b class="num">${amt(mt.income)}</b></div><div><span>Net</span><b class="num">${amt(mt.net, { plus: true })}</b></div></div>`;
  out += `<div class="seg"><button class="${view.recMode === 'list' ? 'on' : ''}" data-a="rec-mode" data-v="list">${icon('list')} List</button>
    <button class="${view.recMode === 'cal' ? 'on' : ''}" data-a="rec-mode" data-v="cal">${icon('calendar')} Calendar</button></div>`;
  if (view.recMode === 'cal') return out + calendar();

  const types = [['all', 'All'], ['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Transfers']];
  out += `<div class="chips scroll">${types.map(([v, l]) => `<button class="chip ${view.recType === v ? 'on' : ''}" data-a="rec-type" data-v="${v}">${l}</button>`).join('')}
    ${accounts(true).map((a) => `<button class="chip ${view.recAcc === a.id ? 'on' : ''}" data-a="rec-acc" data-v="${a.id}"><span class="ellipsis">${esc(a.name)}</span></button>`).join('')}</div>`;
  if (view.recCat) {
    const c = cat(view.recCat);
    out += `<div class="chips"><button class="chip on" data-a="rec-cat" data-v=""><span class="ellipsis">${c ? esc(c.icon) + ' ' + esc(c.name) : 'Category'}</span> ✕</button></div>`;
  }
  out += `<label class="search">${icon('search')}<input id="rec-q" placeholder="Search notes, categories, amounts" value="${esc(view.recQuery)}" data-input="rec-search" type="search" enterkeyhint="search"></label>`;
  return out + `<div id="rec-list" class="stack">${recordsList()}</div>`;
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
  if (!list.length) {
    return `<section class="card"><div class="empty"><span class="e">🔍</span>No records in ${fmtMonth(view.month)}${view.recType !== 'all' || view.recAcc || view.recCat || q ? ' with these filters' : ''}.</div></section>`;
  }
  return byDay(list).map(([d, l]) => dayCard(d, l, view.recAcc ? { accId: view.recAcc } : {})).join('');
}

// Month calendar: each day shows its spending and income; tap a day to see and add its records.
function calendar() {
  const ym = view.month;
  const [y, m] = ym.split('-').map(Number);
  const days = Shared.daysInMonth(y, m);
  const first = new Date(y, m - 1, 1).getDay();
  const t = today();
  if (!view.recDay || view.recDay.slice(0, 7) !== ym) view.recDay = t.slice(0, 7) === ym ? t : ym + '-01';
  const per = {};
  txInMonth(ym).forEach((x) => {
    const p = per[x.date] || (per[x.date] = { out: 0, inc: 0 });
    if (x.type === 'expense') p.out += cents(x.amount);
    if (x.type === 'income') p.inc += cents(x.amount);
  });
  const short = (c) => (M.hideAmounts ? '•••' : moneyShort(c / 100));
  let cells = DAYS.map((d) => `<span class="cal-dow">${d.slice(0, 2)}</span>`).join('');
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const ds = ym + '-' + Shared.pad(d);
    const p = per[ds];
    cells += `<button class="cal-day${ds === t ? ' today' : ''}${ds === view.recDay ? ' on' : ''}${ds > t ? ' future' : ''}" data-a="cal-day" data-v="${ds}">
      <b>${d}</b>${p && p.out ? `<span class="o">−${short(p.out)}</span>` : ''}${p && p.inc ? `<span class="i">+${short(p.inc)}</span>` : ''}</button>`;
  }
  const list = txInMonth(ym).filter((x) => x.date === view.recDay);
  return `<section class="card cal">${cells}</section>
    <div class="section-head"><h2 class="ellipsis">${fmtDate(view.recDay, true)}</h2><button class="btn sm primary" data-a="add" data-date="${view.recDay}">＋ Add</button></div>
    ${list.length ? `<section class="card flush">${list.map((x) => txRow(x)).join('')}</section>` : '<section class="card"><div class="empty">Nothing on this day.</div></section>'}`;
}

// ============================== stats ==============================
function statsScreen() {
  const month = view.statPeriod === 'month';
  const period = month ? view.month : String(view.year);
  const kind = view.statKind;
  const by = byCategoryIn(period, kind);
  const total = Object.values(by).reduce((s, v) => s + v, 0);
  let out = screenHead('Stats', { right: eyeBtn() }) +
    `<div class="seg"><button class="${month ? 'on' : ''}" data-a="stat-period" data-v="month">Month</button><button class="${month ? '' : 'on'}" data-a="stat-period" data-v="year">Year</button></div>` +
    (month ? monthSwitch(view.month, 'month') : yearSwitch(view.year, 'year')) +
    `<div class="seg type"><button class="${kind === 'expense' ? 'on' : ''}" data-a="stat-kind" data-v="expense">Spending</button><button class="${kind === 'income' ? 'on' : ''}" data-a="stat-kind" data-v="income">Income</button></div>`;

  const days = month ? (view.month === thisMonth() ? +today().slice(8) : Shared.daysInMonth(view.year, +view.month.slice(5))) : 0;
  const months = month ? 0 : (String(view.year) === thisMonth().slice(0, 4) ? +thisMonth().slice(5) : 12);
  const avg = month ? total / Math.max(1, days) : total / Math.max(1, months);
  out += `<section class="card"><div class="muted small">${kind === 'expense' ? 'Spent' : 'Income'} in ${month ? fmtMonth(view.month) : view.year}</div>
    <div class="total num">${amt(total)}</div><div class="muted small">Average ${amt(avg)} a ${month ? 'day' : 'month'}</div></section>`;

  const rows = Object.keys(by).map((id) => {
    const c = cat(id);
    return { emoji: c ? esc(c.icon) : '❔', label: c ? esc(c.name) : 'No category', value: by[id], pct: Math.round((by[id] / total) * 100) + '%',
      attrs: `data-a="cat-records" data-id="${esc(id)}"` };
  }).sort((a, b) => b.value - a.value);

  if (!month && rows.length) {
    out += `<div class="top3">${rows.slice(0, 3).map((r, i) => `<div class="top-tile t${i + 1}"><span class="rank-badge">TOP ${i + 1}</span>
      <span class="spread"><span class="ellipsis"><b>${r.label}</b></span><span class="tile-emoji">${r.emoji}</span></span>
      <span class="spread small"><span class="num">${amt(r.value)}</span><span class="muted">${r.pct}</span></span></div>`).join('')}</div>`;
  }

  if (month) {
    const ym = view.month;
    const per = {};
    txInMonth(ym).forEach((t) => { if (t.type === kind) per[t.date] = (per[t.date] || 0) + cents(t.amount); });
    const n = Shared.daysInMonth(+ym.slice(0, 4), +ym.slice(5));
    const data = [];
    for (let d = 1; d <= n; d++) {
      const ds = ym + '-' + Shared.pad(d);
      data.push({ label: String(d), value: (per[ds] || 0) / 100, current: ds === today(), tip: `${d} ${fmtMonthShort(ym)}: ${tipMoney((per[ds] || 0) / 100)}` });
    }
    out += `<section class="card"><div class="card-head"><h2>${kind === 'expense' ? 'Spending' : 'Income'} per day</h2></div>${barsChart(data, 5)}</section>`;
  } else {
    const data = [];
    for (let i = 1; i <= 12; i++) {
      const ym = view.year + '-' + Shared.pad(i);
      const mt = monthTotals(ym);
      data.push({ label: MONTHS[i - 1].slice(0, 1), income: mt.income, expense: mt.expense, current: ym === thisMonth(),
        tip: `${MONTHS[i - 1]}: in ${tipMoney(mt.income)} · out ${tipMoney(mt.expense)}` });
    }
    out += `<section class="card"><div class="card-head"><h2>Income vs spending</h2></div>${columnsChart(data)}</section>`;
  }

  out += `<section class="card"><div class="card-head"><h2>By category</h2><span class="muted small">${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}</span></div>
    ${rows.length ? rankList(rows, kind === 'income' ? 'income' : '') : `<div class="empty">Nothing in ${month ? fmtMonth(view.month) : view.year}.</div>`}</section>`;
  return out;
}

// ============================== wallet ==============================
function walletScreen() {
  const bal = balances();
  const nw = netWorth();
  const all = accounts(true);
  let out = screenHead('Wallet', { right: eyeBtn() + `<button class="icon-btn" data-a="add" data-type="transfer" aria-label="Transfer">${icon('transfer')}</button>` +
    `<button class="icon-btn" data-a="acc-new" aria-label="Add account">${icon('plus')}</button>` });
  out += `<section class="hero"><div class="label">Net worth</div><div class="big num">${amt(nw.net)}</div>
    <div class="duo"><div><span>↗ Assets</span><b class="num">${amt(nw.assets)}</b></div><div><span>↘ Debts</span><b class="num">${amt(nw.debts)}</b></div></div></section>`;
  if (!all.length) {
    return out + `<section class="card stack center-text"><span class="hero-emoji">💳</span><h2>No accounts yet</h2>
      <p class="muted">Add your banks, e-wallets, cards and cash.</p><button class="btn primary block" data-a="acc-new">＋ Add an account</button></section>`;
  }
  const groups = [];
  KIND_ORDER.forEach((k) => { const g = KINDS[k].group; if (groups.indexOf(g) < 0) groups.push(g); });
  groups.forEach((g) => {
    const list = all.filter((a) => !a.archived && kindOf(a).group === g);
    if (!list.length) return;
    const debt = isDebt(list[0]);
    const sum = list.reduce((s, a) => s + cents(bal[a.id]), 0) / 100;
    const base = debt ? nw.debts : nw.assets;
    const share = base ? Math.round((Math.abs(sum) / base) * 100) : 0;
    out += `<div class="section-head"><h2 class="ellipsis">${g}</h2><span class="pct${debt ? ' debt' : ''}">${share}%</span><span class="grow"></span>
      <span class="muted small num">${debt ? 'Owe ' + amt(Math.abs(sum)) : amt(sum)}</span></div>
      <div class="cards">${list.map((a) => cardFace(a, bal[a.id])).join('')}</div>`;
  });
  const hidden = all.filter((a) => a.archived);
  if (hidden.length) {
    out += `<button class="link" data-a="toggle-hidden">${view.showHidden ? 'Hide' : 'Show'} hidden accounts (${hidden.length})</button>`;
    if (view.showHidden) out += `<div class="cards">${hidden.map((a) => cardFace(a, bal[a.id])).join('')}</div>`;
  }
  return out;
}

// ============================== one account ==============================
function accountScreen(id) {
  const a = acc(id);
  if (!a || a.deleted) return screenHead('Account', { back: 'wallet' }) + '<div class="empty">This account was deleted.</div>';
  const ym = view.month;
  const isNow = ym === thisMonth();
  const startBal = balances(Shared.addDays(ym + '-01', -1))[id] || 0;
  const list = txInMonth(ym).filter((t) => t.accountId === id || t.toAccountId === id);
  const m = monthTotals(ym, id);
  let out = screenHead(esc(a.name), { back: 'wallet', right: eyeBtn() + `<button class="icon-btn" data-a="acc-edit" data-id="${id}" aria-label="Edit account">${icon('edit')}</button>` });
  out += cardFace(a, balances(isNow ? '' : monthEnd(ym))[id], { big: true, tag: 'div' });
  out += `<div class="row-btns"><button class="btn" data-a="add" data-acc="${id}">＋ Record</button><button class="btn" data-a="add" data-type="transfer" data-acc="${id}">${icon('transfer')} Transfer</button>
    <button class="btn" data-a="acc-adjust" data-id="${id}">⚖️ Fix balance</button></div>`;
  out += monthSwitch(ym, 'month');
  out += `<div class="figures two"><div><span>Money in</span><b class="num">${amt(m.moneyIn)}</b></div><div><span>Money out</span><b class="num">${amt(m.moneyOut)}</b></div></div>`;

  // Balance at the end of each day of the month (up to today).
  const days = isNow ? +today().slice(8) : Shared.daysInMonth(+ym.slice(0, 4), +ym.slice(5));
  const perDay = {};
  list.forEach((t) => { perDay[t.date] = (perDay[t.date] || 0) + effect(t, id); });
  let run = cents(startBal);
  const pts = [];
  for (let d = 1; d <= days; d++) {
    run += perDay[ym + '-' + Shared.pad(d)] || 0;
    pts.push({ label: String(d), value: run / 100, tip: `${d} ${fmtMonthShort(ym)}: ${tipMoney(run / 100)}` });
  }
  if (pts.length) {
    out += `<section class="card"><div class="card-head"><h2>Balance in ${MONTHS[+ym.slice(5) - 1]}</h2></div>
      ${lineChart(pts.length === 1 ? [{ label: '', value: startBal, tip: tipMoney(startBal) }].concat(pts) : pts, days > 20 ? 7 : days > 10 ? 3 : 1)}</section>`;
  }
  const after = {};
  let r = cents(startBal);
  list.slice().reverse().forEach((t) => { r += effect(t, id); after[t.id] = r / 100; });
  out += list.length ? byDay(list).map(([d, l]) => `<section class="card flush"><div class="day-head"><b>${fmtDay(d)}</b></div>
      ${l.map((t) => txRow(t, { accId: id, running: after[t.id] })).join('')}</section>`).join('')
    : `<section class="card"><div class="empty">No records in ${fmtMonth(ym)}.</div></section>`;
  return out;
}

// ============================== budget ==============================
function budgetScreen() {
  const ym = view.month;
  const cats = categories('expense');
  const withB = cats.filter((c) => c.budget > 0).map((c) => ({ c, b: budgetOf(c, ym) })).sort((x, y) => y.b.pct - x.b.pct);
  const spent = byCategory(ym, 'expense');
  const all = budgetTotals(ym);
  let out = screenHead('Budget', { back: 'home', right: eyeBtn() }) + monthSwitch(ym, 'month');
  if (withB.length) {
    out += `<section class="card"><div class="spread"><span class="muted small">Spent of budget</span>${budgetStatus(all)}</div>
      <div class="total num">${amt(all.spent)} <span class="of">/ ${amt(all.budget)}</span></div>${meter(all)}
      ${perDayLeft(all, ym) ? `<p class="small muted">${perDayLeft(all, ym)}</p>` : ''}</section>`;
    out += '<section class="card flush">' + withB.map(({ c, b }) => `<button class="item" data-a="set-budget" data-id="${c.id}"><span class="bubble">${esc(c.icon)}</span>
      <span class="grow"><span class="spread"><span class="title ellipsis">${esc(c.name)}</span>${budgetStatus(b)}</span>
      <span class="meta ellipsis">${amt(b.spent)} of ${amt(b.budget)}</span>${meter(b)}</span></button>`).join('') + '</section>';
  } else {
    out += `<section class="card"><div class="empty"><span class="e">🎯</span>Give a category a monthly budget<br>and see how much is left as you spend.</div></section>`;
  }
  const rest = cats.filter((c) => !(c.budget > 0));
  if (rest.length) {
    out += `<section class="card flush"><div class="card-head"><h2>No budget yet</h2></div>` + rest.map((c) => `<button class="item" data-a="set-budget" data-id="${c.id}">
      <span class="bubble">${esc(c.icon)}</span><span class="grow"><span class="title ellipsis">${esc(c.name)}</span>
      ${spent[c.id] ? `<span class="meta ellipsis">Spent ${amt(spent[c.id])}</span>` : ''}</span><span class="link">Set</span></button>`).join('') + '</section>';
  }
  return out;
}

// ============================== bills ==============================
function pushBanner() {
  const st = pushState();
  if (CFG.demo) return '<div class="banner"><p>🔔 Notifications work in the real app, not in this preview.</p></div>';
  if (st === 'on') { // a test only until the first one; after that it lives in Settings ▸ Notifications
    return M.pushTested ? '' : `<div class="banner"><div class="spread"><p>🔔 Notifications are on</p><button class="btn sm" data-a="push-test">Send a test</button></div></div>`;
  }
  const text = {
    install: '🔔 To get bill notifications, open My Tracker from your Home Screen (Share ▸ Add to Home Screen).',
    unsupported: '🔔 This phone can’t show notifications from this app. Updating to iOS 16.4 or later fixes it.',
    denied: '🔕 Notifications are blocked. Open iPhone Settings ▸ Notifications ▸ My Tracker and turn on Allow Notifications.',
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
  let out = screenHead('Bills', { back: 'home', right: `<button class="icon-btn" data-a="bill-new" aria-label="Add a bill">${icon('plus')}</button>` }) + pushBanner();
  if (!all.length) {
    return out + `<section class="card stack center-text"><span class="hero-emoji">🗓️</span><h2>Never miss a payment</h2>
      <p class="muted">Add rent, TNB, phone, loans or insurance. Choose when it’s due and when to remind you.</p>
      <button class="btn primary block" data-a="bill-new">＋ Add a bill</button></section>`;
  }
  const sec = (title, list) => (list.length ? `<section class="card flush"><div class="card-head"><h2>${title}</h2></div>${list.map(billRow).join('')}</section>` : '');
  out += sec('Overdue', groups.overdue) + sec('Due soon', groups.soon) + sec('Later', groups.later);
  if (!active.length) out += '<section class="card"><div class="empty">All paid 🎉</div></section>';
  if (done.length) {
    out += `<button class="link" data-a="toggle-done">${view.showDone ? 'Hide' : 'Show'} finished one-time bills (${done.length})</button>`;
    if (view.showDone) {
      out += '<section class="card flush">' + done.map((r) => `<button class="item" data-a="bill-edit" data-id="${r.id}"><span class="bubble">✅</span>
        <span class="grow"><span class="title ellipsis">${esc(r.title)}</span><span class="meta ellipsis">Paid ${r.lastPaid ? fmtDate(r.lastPaid) : ''}</span></span>
        <span class="amt num muted">${r.amount ? amt(r.amount) : ''}</span></button>`).join('') + '</section>';
    }
  }
  return out;
}

// ============================== categories ==============================
function categoriesScreen() {
  const list = live('categories').filter((c) => c.kind === view.catKind).sort((a, b) => (a.archived - b.archived) || (a.order || 0) - (b.order || 0));
  return screenHead('Categories', { back: 'settings', right: `<button class="btn sm ${view.catSort ? 'primary' : ''}" data-a="cat-sort">${view.catSort ? 'Done' : 'Sort'}</button>` }) +
    `<div class="seg type"><button class="${view.catKind === 'expense' ? 'on' : ''}" data-a="cat-kind" data-v="expense">Spending</button>
      <button class="${view.catKind === 'income' ? 'on' : ''}" data-a="cat-kind" data-v="income">Income</button></div>` +
    (view.catSort ? '<p class="small muted center-text">Use the arrows to move categories. The order is used everywhere.</p>' : '') +
    `<section class="card"><div class="cat-tiles">${list.map((c, i) => `<div class="cat-tile${c.archived ? ' off' : ''}">
      <button class="cat" data-a="${view.catSort ? 'noop' : 'cat-edit'}" data-id="${c.id}"><span class="e">${esc(c.icon)}</span><span class="cname">${esc(c.name)}</span>
      ${c.kind === 'expense' && c.budget > 0 && !view.catSort ? `<span class="cbud num">${amt(c.budget)}</span>` : ''}</button>
      ${view.catSort ? `<span class="sort-btns"><button data-a="cat-move" data-id="${c.id}" data-d="-1" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>‹</button>
        <button data-a="cat-move" data-id="${c.id}" data-d="1" aria-label="Move later" ${i === list.length - 1 ? 'disabled' : ''}>›</button></span>` : ''}</div>`).join('')}
      ${view.catSort ? '' : '<button class="cat add" data-a="cat-new"><span class="e">＋</span><span class="cname">New</span></button>'}</div></section>`;
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
    <span class="grow"><span class="title ellipsis">${title}</span>${meta ? `<span class="meta ellipsis">${meta}</span>` : ''}</span>${icon('next')}</button>`;
  const n = accounts(true).length;
  return screenHead('Settings', { back: 'home' }) +
    `<section class="card"><label class="field"><span>Your name</span><input class="input" maxlength="30" value="${esc(setting('name'))}" data-change="set-name" autocomplete="given-name"></label></section>
    <section class="card flush">${link('wallet', '💳', 'Accounts', n + ' account' + (n === 1 ? '' : 's'))}
    ${link('categories', '🏷️', 'Categories', 'Add, rename, sort')}${link('budget', '🎯', 'Budget', 'Monthly budget for each category')}
    ${link('bills', '🗓️', 'Bills', reminders().filter((r) => r.active).length + ' active')}
    ${link('appearance', '🎨', 'Appearance', esc(Theme.label(setting('theme'))))}
    ${link('widget', '📊', 'Home Screen widget', widgetCfg() ? 'On' : 'Off')}</section>
    ${notificationsSection(ps)}
    <section class="card flush">
      <div class="item"><span class="bubble">🙈</span><span class="grow"><span class="title">Hide amounts</span><span class="meta">Show •••• instead of money, e.g. in public</span></span>
        <label class="switch"><input type="checkbox" data-change="privacy-toggle" ${M.hideAmounts ? 'checked' : ''} aria-label="Hide amounts"><i></i></label></div>
      <div class="item"><span class="bubble">🔒</span><span class="grow"><span class="title">App lock</span><span class="meta">Ask for a 4-digit PIN when opening the app</span></span>
        <label class="switch"><input type="checkbox" data-change="pin-toggle" ${M.pinHash ? 'checked' : ''} aria-label="App lock"><i></i></label></div>
      <div class="item"><span class="bubble">☁️</span><span class="grow"><span class="title">Online backup (encrypted)</span>
        <span class="meta">${CFG.demo ? 'Off in the preview' : syncState.error && waiting ? esc(syncState.error) : waiting ? waiting + ' change(s) waiting to upload' : 'Backed up ' + ago(M.lastSync)}</span></span>
        <button class="btn sm" data-a="sync-now" aria-label="Back up now">${icon('sync')}</button></div>
      <button class="item" data-a="export"><span class="bubble">📤</span><span class="grow"><span class="title">Export to a spreadsheet file</span><span class="meta">All records as CSV</span></span>${icon('download')}</button>
    </section>
    ${CFG.demo ? '' : accountSection()}
    <section class="card flush"><button class="item" data-a="sign-out"><span class="bubble">🚪</span><span class="grow"><span class="title danger-text">${CFG.demo ? 'Clear the preview data' : 'Sign out on this phone'}</span>
      <span class="meta">${CFG.demo ? 'Removes the sample data from this phone.' : 'Your data stays backed up online.'}</span></span></button></section>
    <p class="muted tiny center-text">My Tracker v2 · ${esc(CFG.build || 'dev')}${CFG.demo ? ' · preview' : ''}</p>`;
}

// Settings ▸ Notifications: on/off and a test.
function notificationsSection(ps) {
  const why = {
    on: 'Bill reminders and data requests',
    default: 'Off',
    denied: 'Blocked: iPhone Settings ▸ Notifications ▸ My Tracker',
    install: 'Open My Tracker from your Home Screen to use them',
    unsupported: 'Needs iOS 16.4 or later',
  }[ps];
  return `<section class="card flush"><div class="item"><span class="bubble">🔔</span><span class="grow"><span class="title">Notifications</span>
      <span class="meta">${CFG.demo ? 'Not in the preview' : why}</span></span>
      <label class="switch"><input type="checkbox" data-change="push-toggle" ${ps === 'on' ? 'checked' : ''} ${CFG.demo || ps === 'install' || ps === 'unsupported' ? 'disabled' : ''} aria-label="Notifications"><i></i></label></div>
    ${ps === 'on' ? `<button class="item" data-a="push-test"><span class="bubble">📲</span><span class="grow"><span class="title">Send a test notification</span>
      <span class="meta">Check that this phone gets them</span></span>${icon('next')}</button>` : ''}</section>`;
}

function accountSection() {
  const u = M.user || {};
  const pending = pendingRequests().length;
  const row = (a, emoji, title, meta) => `<button class="item" data-a="${a}"><span class="bubble">${emoji}</span>
    <span class="grow"><span class="title ellipsis">${title}</span>${meta ? `<span class="meta ellipsis">${meta}</span>` : ''}</span>${icon('next')}</button>`;
  return `<section class="card flush"><div class="card-head"><h2 class="ellipsis">Account</h2><span class="muted small ellipsis">${esc(u.username || '')}</span></div>
    ${row('change-password', '🔑', 'Change password', '')}
    ${row('telegram', '✈️', 'Telegram for codes', u.telegram ? 'Linked' : 'Not linked: needed if you forget your password')}
    ${row('requests', '📨', 'Data requests', pending ? pending + ' waiting for you' : 'When YC asks for a copy of your data')}</section>`;
}

// ============================== appearance ==============================
// Settings ▸ Appearance. Every choice changes the whole app straight away, and the sample shows it.
function appearanceScreen() {
  const t = Theme.now(); // not the saved one: a redraw mid-slide must keep the sliders where the finger is
  const [hue, shade] = Theme.sliders(t.color);
  const own = !Theme.presetName(t.color);
  return screenHead('Appearance', { back: 'settings' }) +
    `<section class="hero" aria-label="Sample"><div class="label">Sample</div><div class="big num">${money(1280)}</div>
      <div class="trio"><div><span>Income</span><b class="num">${money(3500)}</b></div><div><span>Net</span><b class="num">${money(2220, { plus: true })}</b></div>
      <div><span>Budget left</span><b class="num">${money(720)}</b></div></div></section>
    <section class="card stack"><h2>Light or dark</h2>
      <div class="seg">${Object.keys(Theme.MODES).map((m) => `<button class="${t.mode === m ? 'on' : ''}" data-a="theme-mode" data-v="${m}">${Theme.MODES[m]}</button>`).join('')}</div>
      <p class="muted small">Auto follows your phone.</p></section>
    <section class="card stack"><h2>Colour</h2>
      <div class="themes">${Theme.PRESETS.map(([name, c]) => `<button class="${t.color === c ? 'on' : ''}" data-a="theme-color" data-v="${c}" aria-label="${name}">
        <i style="--c:${c};--k:${Theme.palette(c, false)['brand-ink']}">${icon('check')}</i><span class="ellipsis">${name}</span></button>`).join('')}</div></section>
    <section class="card stack"><div class="spread"><h2>Your own colour</h2><span id="th-own" class="muted small" ${own ? '' : 'hidden'}>In use</span></div>
      <label class="field"><span>Colour</span><input type="range" id="th-hue" class="range hue" min="0" max="359" value="${hue}" data-input="theme-try" data-change="theme-keep" aria-label="Colour"></label>
      <label class="field"><span>Shade</span><input type="range" id="th-shade" class="range shade" style="--h:${hue}" min="${Theme.SHADES[0]}" max="${Theme.SHADES[1]}" value="${shade}" data-input="theme-try" data-change="theme-keep" aria-label="Shade"></label></section>`;
}

function saveTheme(change) {
  const t = Object.assign(Theme.read(setting('theme')), change);
  put('settings', { id: 'theme', value: t });
  Theme.set(t);
}
const sliderColor = () => Theme.fromSliders(+$('#th-hue').value, +$('#th-shade').value);
actions['theme-mode'] = (el) => saveTheme({ mode: el.dataset.v });
actions['theme-color'] = (el) => saveTheme({ color: el.dataset.v });
// While a slider moves only the colours change: redrawing the screen would drop the finger's hold on it.
actions['theme-try'] = () => {
  $('#th-shade').style.setProperty('--h', $('#th-hue').value);
  Theme.preview(Object.assign(Theme.read(setting('theme')), { color: sliderColor() }));
};
actions['theme-keep'] = () => saveTheme({ color: sliderColor() });

const SCREENS = {
  home: homeScreen, records: recordsScreen, stats: statsScreen, wallet: walletScreen, account: accountScreen, budget: budgetScreen,
  bills: billsScreen, settings: settingsScreen, categories: categoriesScreen, appearance: appearanceScreen,
};
const ROUTE_ALIAS = { reports: 'stats', accounts: 'wallet' }; // v1 links
const TAB_OF = { home: 'home', settings: 'home', appearance: 'home', budget: 'home', bills: 'home', categories: 'home', records: 'records', stats: 'stats', wallet: 'wallet', account: 'wallet' };
