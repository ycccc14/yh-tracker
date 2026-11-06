// Home Screen widgets. A web app can't make one itself, so two small helpers show it: a Scriptable script on
// iPhone (web/widget/scriptable.js) and a tiny Android app (android-widget/). This app paints the finished
// widgets (widget-art.js) and, after each sync, seals the pictures and a short summary with the widget key.
// The server can't open them, and the widget's token can fetch only those, never the records.
// settings 'widget' = { t: token, k: key, designs: {s, m, l}, back, color, short, cat, tap };
// settings 'widgetpic' = the background picture, so a second phone paints the same widgets.
'use strict';

const WIDGET_APK = 'widget/my-tracker-widget.apk';
const WIDGET_PACKAGE = 'com.ycccc14.mytracker.widget';
const SCRIPTABLE_APP = 'https://apps.apple.com/app/scriptable/id1405459188';
const WIDGET_DEFAULTS = { designs: { s: 'balance', m: 'classic', l: 'compare' }, back: 'paper', color: '', short: false, cat: '', tap: 'app' };
const WIDGET_IMAGE_BYTES = 36000; // sealed, this still fits one Sheet cell
const WIDGET_PICTURE_BYTES = 25000; // as a sealed record this stays under the server's 49,000 characters (test/server.test.js)
let widgetScript = ''; // loaded when the screen opens: iPhones only copy straight from the tap
const widgetPics = {}; // loaded images by address

const widgetCfg = () => { const w = setting('widget'); return w && w.t && w.k ? Object.assign({}, WIDGET_DEFAULTS, w, { designs: Object.assign({}, WIDGET_DEFAULTS.designs, w.designs) }) : null; };
const widgetCode = (w) => `MTW1|${CFG.api}|${w.t}|${w.k}`;
const isAndroid = () => /Android/.test(navigator.userAgent);
const shortName = (s) => String(s).slice(0, 20);
const widgetColor = (w) => (/^#[0-9A-F]{6}$/i.test(w.color) ? w.color : Theme.read(setting('theme')).color);
const widgetStyle = (w) => ({ back: w.back, color: widgetColor(w), short: !!w.short });
const saveWidget = (change) => put('settings', { id: 'widget', value: Object.assign({}, setting('widget'), change) });

function spentToday() {
  const d = today();
  return live('transactions').filter((t) => t.type === 'expense' && t.date === d).reduce((s, t) => s + cents(t.amount), 0) / 100;
}

// Everything the designs show, worked out here on the phone.
function widgetData(w) {
  const ym = thisMonth();
  const prev = shiftMonth(ym, -1);
  const mt = monthTotals(ym);
  const was = monthTotals(prev);
  const b = budgetTotals(ym);
  const nw = netWorth();
  const spent = byCategory(ym, 'expense');
  const name = (m) => MONTHS_LONG[+m.slice(5) - 1].slice(0, 3);
  const catInfo = (c) => { const x = budgetOf(c, ym); return { name: shortName(c.name), icon: c.icon || '', spent: x.spent, budget: x.budget, left: x.left }; };
  const all = categories('expense');
  const pick = all.find((c) => c.id === w.cat) || all.filter((c) => spent[c.id]).sort((p, q) => spent[q.id] - spent[p.id])[0] || all[0];
  return { cur: setting('currency') || 'RM', month: name(ym), prevMonth: name(prev), expense: mt.expense, income: mt.income, net: Calc.round2(mt.income - mt.expense),
    prevExpense: was.expense, prevIncome: was.income, prevNet: Calc.round2(was.income - was.expense), balance: nw.net, assets: nw.assets, debts: nw.debts, today: spentToday(),
    budget: b.budget, spent: b.spent, left: b.left, cat: pick ? catInfo(pick) : null,
    cats: all.filter((c) => spent[c.id]).sort((p, q) => spent[q.id] - spent[p.id]).slice(0, 6).map(catInfo),
    recent: txSorted().filter((t) => t.type !== 'adjust').slice(0, 7).map((t) => { const c = cat(t.categoryId); return { icon: t.type === 'transfer' ? '🔁' : (c && c.icon) || '🧾', name: t.note || (c ? c.name : 'Transfer'), amount: t.amount, type: t.type }; }) };
}

// What the widget apps need besides the pictures: where the buttons are, and the iPhone's add form.
function widgetSummary(w) {
  const cats = (kind) => categories(kind, true).slice(0, 24).map((c) => ({ i: c.id, n: shortName(c.name), e: c.icon || '' }));
  const quick = (size) => !!(WidgetArt.DESIGNS[w.designs[size]] || {}).buttons;
  return { v: 3, quick: { s: quick('s'), m: quick('m'), l: quick('l') }, tap: w.tap, cur: setting('currency') || 'RM',
    accounts: accounts().slice(0, 12).map((a) => ({ i: a.id, n: shortName(a.name) })), ex: cats('expense'), in: cats('income') };
}

function loadPic(src) {
  if (!src) return Promise.resolve(null);
  if (widgetPics[src]) return Promise.resolve(widgetPics[src]);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { widgetPics[src] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
async function widgetArtwork() {
  const [art, picture] = await Promise.all([loadPic('widget/art.png'), loadPic(setting('widgetpic'))]);
  return { art, picture };
}

// A canvas as bytes that always fit one Sheet cell: PNG keeps text crisp; a picture background needs JPEG,
// and a very detailed one also a lower resolution.
function canvasBytes(cv, photo) {
  const fits = (url) => url.length * 0.75 <= WIDGET_IMAGE_BYTES;
  let url = cv.toDataURL('image/png');
  if (!photo && fits(url)) return url;
  for (let zoom = 1; zoom >= 0.4; zoom -= 0.15) {
    const small = document.createElement('canvas');
    small.width = Math.round(cv.width * zoom);
    small.height = Math.round(cv.height * zoom);
    small.getContext('2d').drawImage(cv, 0, 0, small.width, small.height);
    for (let q = 0.82; q > 0.4; q -= 0.1) {
      url = small.toDataURL('image/jpeg', q);
      if (fits(url)) return url;
    }
  }
  return url;
}

function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return h;
}

// After a sync: paints and uploads whatever changed (a new record, a new month, a new design or colour).
async function pushWidget() {
  const w = widgetCfg();
  if (!w || CFG.demo) return;
  const data = widgetData(w);
  const summary = widgetSummary(w);
  const pics = await widgetArtwork();
  const state = w.t + hashText(JSON.stringify([data, summary, w, setting('widgetpic').length, Theme.read(setting('theme'))]));
  if (state === M.widgetSent) return;
  await api('widgetPut', { t: w.t, data: await Crypt.sealJson(await Crypt.dataKey(w.k), summary) });
  for (const size of Object.keys(WidgetArt.SIZES)) {
    const cv = document.createElement('canvas');
    WidgetArt.paint(cv, size, w.designs[size], widgetStyle(w), data, pics, 2);
    const url = canvasBytes(cv, w.back === 'picture' && !!pics.picture);
    await api('widgetImg', { t: w.t, size, data: await Crypt.wrapKey(url.slice(url.indexOf(',') + 1).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), w.k) });
  }
  M.widgetSent = state;
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

// Called by sync with new inbox rows (the iPhone add form). Ids are fixed, so a second phone adds nothing.
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
  }
}

function loadWidgetScript() {
  if (widgetScript) return;
  fetch('widget/scriptable.js').then((r) => (r.ok ? r.text() : '')).then((t) => { widgetScript = t; }).catch(() => {});
}

// Opens the Android widget app with the code, or downloads the app if it isn't installed yet.
function androidLink(w, size) {
  const code = Crypt.b64(new TextEncoder().encode(widgetCode(w)));
  const fallback = encodeURIComponent(new URL(WIDGET_APK, location.href).href);
  return `intent://connect/${code}?size=${size}#Intent;scheme=mytrackerwidget;package=${WIDGET_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

// The previews are the same drawing as the real thing, painted once the screen is on the page.
async function paintWidgetPreviews() {
  const w = widgetCfg();
  const list = $$('canvas[data-design]');
  if (!w || !list.length) return;
  const data = widgetData(w);
  const pics = await widgetArtwork();
  list.forEach((cv) => WidgetArt.paint(cv, cv.dataset.size, cv.dataset.design, widgetStyle(w), data, pics, 1.5));
}

function widgetScreen() {
  const w = widgetCfg();
  if (w) loadWidgetScript();
  const head = screenHead('Home Screen widget', { back: 'settings' });
  const toggle = `<section class="card flush"><div class="item"><span class="bubble">📊</span><span class="grow"><span class="title">Widget</span>
      <span class="meta">${CFG.demo ? 'Not in the preview' : 'Your money on the Home Screen. Anyone who sees your Home Screen sees these numbers.'}</span></span>
      <label class="switch"><input type="checkbox" data-change="widget-toggle" ${w ? 'checked' : ''} ${CFG.demo ? 'disabled' : ''} aria-label="Widget"><i></i></label></div></section>`;
  if (!w) return head + toggle;
  const size = WidgetArt.SIZES[view.wsize] ? view.wsize : 'm';
  const sizes = Object.keys(WidgetArt.SIZES).map((k) => `<button class="${k === size ? 'on' : ''}" data-a="widget-size" data-v="${k}">${WidgetArt.SIZES[k].name}</button>`).join('');
  const designs = `<section class="card stack"><h2>Choose a design</h2><div class="seg">${sizes}</div>
      <div class="wdesigns ${size}">${WidgetArt.designsFor(size).map((id) => `<button class="wdesign ${w.designs[size] === id ? 'on' : ''}" data-a="widget-design" data-size="${size}" data-v="${id}" aria-label="${WidgetArt.DESIGNS[id].name}">
        <canvas data-size="${size}" data-design="${id}"></canvas><b class="ellipsis">${WidgetArt.DESIGNS[id].name}</b></button>`).join('')}</div>
      <p class="muted small">Each size keeps its own design. Widgets change by themselves, usually within 30 minutes.</p></section>`;
  const usesCat = Object.values(w.designs).includes('category');
  const look = `<section class="card stack"><h2>Customise</h2>
      <div class="field"><span>Background</span><div class="chips">${WidgetArt.BACKS.map(([id, name]) => `<button class="chip ${w.back === id ? 'on' : ''}" data-a="widget-back" data-v="${id}">${name}</button>`).join('')}</div></div>
      ${w.back === 'picture' ? `<div class="pic-btns"><label class="btn file-pick">🖼️ ${setting('widgetpic') ? 'Change picture' : 'Choose a picture'}<input type="file" accept="image/*" data-change="widget-picture"></label>
        ${setting('widgetpic') ? '<button class="btn" data-a="widget-picture-clear">Remove</button>' : ''}</div>` : ''}
      <div class="field"><span>Colour</span><div class="swatches"><button class="${w.color ? '' : 'on'}" style="background:${Theme.read(setting('theme')).color}" data-a="widget-color" data-v="" aria-label="Same as the app"></button>
        ${Theme.PRESETS.map(([name, c]) => `<button class="${w.color === c ? 'on' : ''}" style="background:${c}" data-a="widget-color" data-v="${c}" aria-label="${name}"></button>`).join('')}</div></div>
      ${usesCat ? `<label class="field"><span>Category to show</span><select class="input" data-change="widget-cat"><option value="">Biggest spending</option>
        ${categories('expense').map((c) => `<option value="${esc(c.id)}" ${w.cat === c.id ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <div class="spread"><span>Short amounts (RM4.7k)</span><label class="switch"><input type="checkbox" data-change="widget-short" ${w.short ? 'checked' : ''} aria-label="Short amounts"><i></i></label></div></section>`;
  const iphone = `<section class="card stack"><h2>iPhone</h2><ol class="steps">
      <li><span>Get the free app <a class="link" href="${SCRIPTABLE_APP}" target="_blank" rel="noopener">Scriptable</a> from the App Store.</span></li>
      <li><span>Tap <b>Copy script</b> below.</span></li>
      <li><span>In Scriptable tap <b>＋</b>, paste, and tap <b>Done</b>.</span></li>
      <li><span>Touch and hold your Home Screen, tap <b>Edit ▸ Add Widget</b>, pick <b>Scriptable</b> and the size you want.</span></li>
      <li><span>Touch and hold the new widget, tap <b>Edit Widget</b>, and choose your script under <b>Script</b>.</span></li></ol>
      <button class="btn primary block" data-a="widget-copy-script">Copy script</button>
      <div class="field"><span>Tapping the widget on iPhone</span><div class="seg"><button class="${w.tap === 'app' ? 'on' : ''}" data-a="widget-tap" data-v="app">Opens My Tracker in Safari</button><button class="${w.tap === 'form' ? 'on' : ''}" data-a="widget-tap" data-v="form">Quick form</button></div></div>
      <p class="muted small">iPhones can’t open the Home Screen app from a widget. Safari has its own sign-in, so sign in there once. The quick form needs no sign-in, and its records appear when My Tracker next opens.</p></section>`;
  const android = `<section class="card stack"><h2>Android</h2><ol class="steps">
      <li><span>Download the small widget app, open the file and allow it. You only do this once.</span></li></ol>
      <a class="btn block" href="${WIDGET_APK}" download="my-tracker-widget.apk">Download the widget app</a>
      ${isAndroid() ? `<ol class="steps" start="2" style="counter-reset:s 1"><li><span>Tap the size you want, then <b>Add</b>. If you don’t see the widget, swipe to your next Home Screen page.</span></li></ol>
      <div class="row-btns">${Object.keys(WidgetArt.SIZES).map((k) => `<a class="btn primary" href="${esc(androidLink(w, k))}">Add ${WidgetArt.SIZES[k].name}</a>`).join('')}</div>` : ''}
      <p class="muted small">Not working? Tap <button class="link" data-a="widget-copy-code">Copy code</button>, then open the widget app and paste it.</p></section>`;
  const note = '<p class="muted small center-text">The code and script are like a key to these numbers, so keep them to yourself. Turning the widget off makes them stop working.</p>';
  return head + toggle + designs + look + (isIOS() ? iphone + android : android + iphone) + note;
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch (e) {
    toast('Couldn’t copy. Please try again.');
  }
}

// A chosen picture, shrunk until it fits one synced record.
function widgetPicture(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      for (let side = 720; side >= 240; side -= 120) {
        const zoom = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        cv.width = Math.round(img.naturalWidth * zoom);
        cv.height = Math.round(img.naturalHeight * zoom);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        for (let q = 0.7; q >= 0.34; q -= 0.12) {
          const url = cv.toDataURL('image/jpeg', q);
          if (url.length * 0.75 <= WIDGET_PICTURE_BYTES) { resolve(url); return; }
        }
      }
      reject(new Error('too big'));
    };
    img.onerror = () => reject(new Error('bad picture'));
    const reader = new FileReader(); // a data: URL, because the page's security policy doesn't allow blob: images
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(new Error('bad picture'));
    reader.readAsDataURL(file);
  });
}

actions['widget-copy-code'] = () => copyText(widgetCode(widgetCfg()), 'Code copied ✓');
actions['widget-copy-script'] = () => {
  if (!widgetScript) { loadWidgetScript(); toast('Still loading. Tap again in a moment.'); return; }
  copyText(widgetScript.replace('__WIDGET_CODE__', widgetCode(widgetCfg())), 'Script copied ✓');
};
actions['widget-size'] = (el) => { view.wsize = el.dataset.v; render(); };
actions['widget-design'] = (el) => saveWidget({ designs: Object.assign({}, widgetCfg().designs, { [el.dataset.size]: el.dataset.v }) });
actions['widget-back'] = (el) => saveWidget({ back: el.dataset.v });
actions['widget-color'] = (el) => saveWidget({ color: el.dataset.v });
actions['widget-cat'] = (el) => saveWidget({ cat: el.value });
actions['widget-short'] = (el) => saveWidget({ short: el.checked });
actions['widget-tap'] = (el) => saveWidget({ tap: el.dataset.v });
actions['widget-picture'] = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  try {
    put('settings', { id: 'widgetpic', value: await widgetPicture(file) });
  } catch (e) {
    toast('That picture couldn’t be opened. Try another one.');
  }
};
actions['widget-picture-clear'] = () => remove('settings', 'widgetpic');

actions['widget-toggle'] = async (el) => {
  const w = widgetCfg();
  if (el.checked) {
    put('settings', { id: 'widget', value: Object.assign({}, WIDGET_DEFAULTS, { t: Crypt.newKey(), k: Crypt.newKey() }) }); // the next sync uploads it
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
