// Home Screen widgets. A web app can't draw one itself, so two small helpers do: a Scriptable script on
// iPhone (web/widget/scriptable.js) and a tiny Android app (android-widget/). Both read the same thing:
// a short summary this phone seals with the widget key and uploads after each sync. The server can't
// open it, and the widget's token can fetch only that summary, never the records.
// A record added on a widget travels the other way: sealed with the same key into the user's inbox,
// where the next sync on a phone opens it and adds the real record (takeWidgetInbox).
// settings 'widget' = { t: token, k: key, design }, so a second phone keeps the same widgets up to date.
'use strict';

const WIDGET_APK = 'widget/my-tracker-widget.apk';
const WIDGET_PACKAGE = 'com.ycccc14.mytracker.widget';
const SCRIPTABLE_APP = 'https://apps.apple.com/app/scriptable/id1405459188';
const WIDGET_DESIGNS = [['classic', 'Classic', 'Picture and all three numbers'], ['balance', 'Balance', 'Your balance, big and simple'],
  ['budget', 'Budget', 'What’s left of your budget'], ['quick', 'Quick add', 'Add a record in one tap']];
let widgetScript = ''; // loaded when the screen opens: iPhones only copy straight from the tap

const widgetCfg = () => { const w = setting('widget'); return w && w.t && w.k ? w : null; };
const widgetCode = (w) => `MTW1|${CFG.api}|${w.t}|${w.k}`;
const isAndroid = () => /Android/.test(navigator.userAgent);
const shortName = (s) => String(s).slice(0, 20);

function spentToday() {
  const d = today();
  return live('transactions').filter((t) => t.type === 'expense' && t.date === d).reduce((s, t) => s + cents(t.amount), 0) / 100;
}

function widgetSummary() {
  const ym = thisMonth();
  const mt = monthTotals(ym);
  const b = budgetTotals(ym);
  const p = Theme.palette(Theme.read(setting('theme')).color, false);
  const cats = (kind) => categories(kind, true).slice(0, 24).map((c) => ({ i: c.id, n: shortName(c.name), e: c.icon || '' }));
  return { v: 2, design: (widgetCfg() || {}).design || 'classic', ym, day: today(), month: MONTHS_LONG[+ym.slice(5) - 1].slice(0, 3), cur: setting('currency') || 'RM',
    expense: mt.expense, income: mt.income, balance: netWorth().net, today: spentToday(), budget: b.budget, spent: b.spent, left: b.left, color: p.brand, ink: p['brand-ink'],
    accounts: accounts().slice(0, 12).map((a) => ({ i: a.id, n: shortName(a.name) })), ex: cats('expense'), in: cats('income'), done: (M.widgetDone || []).slice(-30) };
}

// After a sync: uploads the summary if it changed (a new record, a new month, a new colour or design).
async function pushWidget() {
  const w = widgetCfg();
  if (!w || CFG.demo) return;
  const summary = widgetSummary();
  const sent = w.t + JSON.stringify(summary);
  if (sent === M.widgetSent) return;
  await api('widgetPut', { t: w.t, data: await Crypt.sealJson(await Crypt.dataKey(w.k), summary) });
  M.widgetSent = sent;
  persist();
}

// A widget's entry is outside input: only known types, accounts and categories become a record.
function recordFromWidget(e) {
  const amount = Calc.round2(Number(e.amount));
  if (!['expense', 'income', 'transfer'].includes(e.type) || !(amount > 0 && amount < 1e9)) return null;
  const known = (id) => !!id && !!S.accounts[id] && !S.accounts[id].deleted;
  const accountId = known(e.accountId) ? e.accountId : defaultAccount();
  if (!accountId) return null;
  const rec = { id: 'w' + e.id, date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : today(), type: e.type, amount, accountId, toAccountId: '', categoryId: '', note: String(e.note || '').slice(0, 200) };
  if (e.type === 'transfer') {
    if (!known(e.toAccountId) || e.toAccountId === accountId) return null;
    rec.toAccountId = e.toAccountId;
    return rec;
  }
  const c = cat(e.categoryId);
  rec.categoryId = c && !c.deleted && c.kind === e.type ? c.id : (categories(e.type)[0] || {}).id || '';
  return rec;
}

// Called by sync with new inbox rows. Ids are fixed, so a second phone taking the same row adds nothing.
async function takeWidgetInbox(rows) {
  const w = widgetCfg();
  if (!w) return;
  const key = await Crypt.dataKey(w.k);
  for (const row of rows) {
    if (row.deleted || !row.data) continue;
    let entry;
    try { entry = await Crypt.openJson(key, row.data); } catch (e) { console.error('Could not open a widget record', row.id); continue; }
    const rec = entry.id === row.id ? recordFromWidget(entry) : null;
    if (rec && !S.transactions[rec.id]) put('transactions', rec);
    M.inboxDone = (M.inboxDone || []).concat({ id: row.id, updatedAt: row.updatedAt + 1, deleted: true, data: '' });
    M.widgetDone = (M.widgetDone || []).concat(row.id).slice(-30);
  }
}

function loadWidgetScript() {
  if (widgetScript) return;
  fetch('widget/scriptable.js').then((r) => (r.ok ? r.text() : '')).then((t) => { widgetScript = t; }).catch(() => {});
}

// Opens the Android widget app with the code, or downloads the app if it isn't installed yet.
function androidLink(w) {
  const code = Crypt.b64(new TextEncoder().encode(widgetCode(w)));
  const fallback = encodeURIComponent(new URL(WIDGET_APK, location.href).href);
  return `intent://connect/${code}#Intent;scheme=mytrackerwidget;package=${WIDGET_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

function designPreview(id, s) {
  const pct = s.budget ? Math.min(100, Math.round(s.spent / s.budget * 100)) : 0;
  if (id === 'balance') return `<span class="wmini full"><span>Balance</span><b class="num">${amt(s.balance)}</b><span class="ellipsis">${esc(s.month)}: spent ${amt(s.expense)}</span></span>`;
  if (id === 'budget') {
    return `<span class="wmini"><span class="row"><span>Budget</span><b>${esc(s.month)}</b></span><span class="big num">${s.budget ? amt(s.left) + ' left' : 'No budget'}</span>
      <span class="track"><i style="width:${pct}%"></i></span><span class="ellipsis">${s.budget ? `${amt(s.spent)} of ${amt(s.budget)}` : 'Set one in Budget'}</span></span>`;
  }
  if (id === 'quick') {
    return `<span class="wmini"><span class="row"><span>Today ${amt(s.today)}</span><b class="ellipsis">${amt(s.balance)}</b></span>
      <span class="btns"><span>＋ Exp</span><span>＋ Inc</span><span>⇄ Move</span></span></span>`;
  }
  return `<span class="wmini"><span class="art"><span>☀️ 🌰</span><span class="sign">${esc(s.month)}</span></span>
    <span class="blk"><span><span>Expenses</span><b class="num">${amt(s.expense)}</b></span><span><span>Income</span><b class="num">${amt(s.income)}</b></span><span><span>Balance</span><b class="num">${amt(s.balance)}</b></span></span></span>`;
}

function widgetScreen() {
  const w = widgetCfg();
  if (w) loadWidgetScript();
  const head = screenHead('Home Screen widget', { back: 'settings' });
  const toggle = `<section class="card flush"><div class="item"><span class="bubble">📊</span><span class="grow"><span class="title">Widget</span>
      <span class="meta">${CFG.demo ? 'Not in the preview' : 'Your money on the Home Screen. Anyone who sees your Home Screen sees these numbers.'}</span></span>
      <label class="switch"><input type="checkbox" data-change="widget-toggle" ${w ? 'checked' : ''} ${CFG.demo ? 'disabled' : ''} aria-label="Widget"><i></i></label></div></section>`;
  if (!w) return head + toggle;
  const s = widgetSummary();
  const look = Theme.palette(Theme.read(setting('theme')).color, false);
  const designs = `<section class="card stack" style="--c:${look.brand};--k:${look['brand-ink']}"><h2>Choose a design</h2><div class="wdesigns">
      ${WIDGET_DESIGNS.map(([id, name, about]) => `<button class="wdesign ${s.design === id ? 'on' : ''}" data-a="widget-design" data-v="${id}" aria-label="${name}">${designPreview(id, s)}<b>${name}</b><small>${about}</small></button>`).join('')}</div>
      <p class="muted small">Widgets switch by themselves, usually within 30 minutes. Nothing to set up again.</p></section>`;
  const iphone = `<section class="card stack"><h2>iPhone</h2><ol class="steps">
      <li><span>Get the free app <a class="link" href="${SCRIPTABLE_APP}" target="_blank" rel="noopener">Scriptable</a> from the App Store.</span></li>
      <li><span>Tap <b>Copy script</b> below.</span></li>
      <li><span>In Scriptable tap <b>＋</b>, paste, and tap <b>Done</b>.</span></li>
      <li><span>Touch and hold your Home Screen, tap <b>Edit ▸ Add Widget</b>, pick <b>Scriptable</b> (the wide size) and add it.</span></li>
      <li><span>Touch and hold the new widget, tap <b>Edit Widget</b>, and choose your script under <b>Script</b>.</span></li></ol>
      <button class="btn primary block" data-a="widget-copy-script">Copy script</button>
      <p class="muted small">Tapping the widget opens Scriptable to add a record, because iPhones can’t open My Tracker from a widget.</p></section>`;
  const android = `<section class="card stack"><h2>Android</h2>
      ${isAndroid() ? `<a class="btn primary block" href="${esc(androidLink(w))}">Set up widget</a>
      <p class="muted small">The first time, this downloads a small app: open the file and allow it, then tap <b>Set up widget</b> again. After that, just tap <b>Add</b>. If you don’t see it, swipe to your next Home Screen page.</p>` : ''}
      <p class="muted small">Not working? <a class="link" href="${WIDGET_APK}" target="_blank" rel="noopener">Download the widget app</a>, tap <button class="link" data-a="widget-copy-code">Copy code</button>, then open the app and paste it.</p></section>`;
  const note = '<p class="muted small center-text">Records added on a widget show in My Tracker the next time you open it. The code and script are like a key to these numbers, so keep them to yourself. Turning the widget off makes them stop working.</p>';
  return head + toggle + designs + (isIOS() ? iphone + android : android + iphone) + note;
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch (e) {
    toast('Couldn’t copy. Please try again.');
  }
}

actions['widget-copy-code'] = () => copyText(widgetCode(widgetCfg()), 'Code copied ✓');
actions['widget-copy-script'] = () => {
  if (!widgetScript) { loadWidgetScript(); toast('Still loading. Tap again in a moment.'); return; }
  copyText(widgetScript.replace('__WIDGET_CODE__', widgetCode(widgetCfg())), 'Script copied ✓');
};
actions['widget-design'] = (el) => put('settings', { id: 'widget', value: Object.assign({}, widgetCfg(), { design: el.dataset.v }) });

actions['widget-toggle'] = async (el) => {
  const w = widgetCfg();
  if (el.checked) {
    put('settings', { id: 'widget', value: { t: Crypt.newKey(), k: Crypt.newKey(), design: 'classic' } }); // the next sync uploads the summary
    return;
  }
  if (!(await confirmSheet('Turn the widget off?', 'Widgets on your phones go blank, and their code stops working. Turning it on again gives a new code.', 'Turn off', true))) { el.checked = true; return; }
  try {
    await api('widgetOff', { t: w.t });
    remove('settings', 'widget');
  } catch (e) {
    el.checked = true;
    toast(e.message);
  }
};

SCREENS.widget = widgetScreen;
TAB_OF.widget = 'home';
