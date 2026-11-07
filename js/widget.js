// Home Screen widgets. A web app can't make one itself, so they are shown by a Scriptable script on iPhone
// (web/widget/scriptable.js) and by the Android app (android-app/), which has them built in. This app paints them
// (widget-art.js) and, after each sync, seals the pictures and a short summary with the widget key.
// The server can't open them, and the widget's token can fetch only those, never the records.
//
// The library: settings 'widget' = { t: token, k: key, tap, next, items: { id: { name, size, design, back, color, short, cat } } }.
// Each saved widget has its own look, in use or not. A Home Screen widget shows the item it was added from (Android)
// or the number in its Parameter (iPhone). Items 's' and 'm' are the defaults, for widgets that didn't choose one.
// Each item's picture is its own record, settings 'widgetpic:<id>', because a record has to stay under 49,000 characters.
'use strict';

const ANDROID_APK = 'android/My-Tracker.apk';
const SCRIPTABLE_APP = 'https://apps.apple.com/app/scriptable/id1405459188';
const WIDGET_MAX = 12;
const WIDGET_LOOK = { back: 'paper', color: '', short: false, cat: '' };
const WIDGET_IMAGE_BYTES = 36000; // sealed, this still fits one Sheet cell
const WIDGET_PICTURE_BYTES = 25000; // as a sealed record this stays under the server's 49,000 characters (test/server.test.js)
const WIDGET_UPLOAD = 2; // raise it to send every picture again, with a new date
const WIDGET_USED_DAYS = 3; // a widget fetched this recently is on a Home Screen, so its numbers are kept fresh
let widgetScript = ''; // loaded when the screen opens: iPhones only copy straight from the tap
const widgetPics = {}; // loaded images by address
let widgetQueue = Promise.resolve(); // one upload at a time

const validDesign = (size, design) => (WidgetArt.designsFor(size).includes(design) ? design : size === 's' ? 'balance' : 'classic');

// Read-only, so it's safe in a redraw. A library saved before there were several widgets reads as the two defaults.
function widgetCfg() {
  const w = setting('widget');
  if (!w || !w.t || !w.k) return null;
  const old = { back: w.back || 'paper', color: w.color || '', short: !!w.short, cat: w.cat || '' };
  const designs = w.designs || {};
  const items = Object.assign({
    s: Object.assign({ name: 'Small', size: 's', design: validDesign('s', designs.s) }, old),
    m: Object.assign({ name: 'Wide', size: 'm', design: validDesign('m', designs.m) }, old),
  }, w.items);
  return { t: w.t, k: w.k, tap: w.tap === 'form' ? 'form' : 'app', next: w.next || 1, items };
}

const widgetIds = (w) => Object.keys(w.items).sort((a, b) => (a < 'a' ? Number(a) : -1) - (b < 'a' ? Number(b) : -1) || b.localeCompare(a));
const widgetCode = (w) => `MTW1|${CFG.api}|${w.t}|${w.k}`;
const isAndroid = () => /Android/.test(navigator.userAgent);
const shortName = (s) => String(s).slice(0, 20);
const widgetColor = (item) => (/^#[0-9A-F]{6}$/i.test(item.color) ? item.color : Theme.read(setting('theme')).color);
const widgetStyle = (item) => ({ back: item.back, color: widgetColor(item), short: !!item.short });
const widgetInUse = (id) => (M.widgetUsed || {})[id] > Date.now() - WIDGET_USED_DAYS * 864e5;
const saveWidgetCfg = (change) => put('settings', { id: 'widget', value: Object.assign({}, setting('widget'), change) });
const saveItem = (id, change) => { const w = widgetCfg(); saveWidgetCfg({ items: Object.assign({}, w.items, { [id]: Object.assign({}, w.items[id], change) }) }); };

// A default item's picture may still be in the record all widgets shared before the library. 'none' = removed.
function itemPic(id) {
  const own = setting('widgetpic:' + id);
  if (own) return own === 'none' ? '' : own;
  return id === 's' || id === 'm' ? setting('widgetpic') : '';
}

function spentToday() {
  const d = today();
  return live('transactions').filter((t) => t.type === 'expense' && t.date === d).reduce((s, t) => s + cents(t.amount), 0) / 100;
}

// Everything the designs show, worked out here on the phone.
function widgetData() {
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
  const biggest = all.filter((c) => spent[c.id]).sort((p, q) => spent[q.id] - spent[p.id]);
  return { cur: setting('currency') || 'RM', month: name(ym), prevMonth: name(prev), expense: mt.expense, income: mt.income, net: Calc.round2(mt.income - mt.expense),
    prevExpense: was.expense, prevIncome: was.income, prevNet: Calc.round2(was.income - was.expense), balance: nw.net, assets: nw.assets, debts: nw.debts, today: spentToday(),
    budget: b.budget, spent: b.spent, left: b.left,
    pickCat: (id) => { const c = all.find((x) => x.id === id) || biggest[0] || all[0]; return c ? catInfo(c) : null; },
    cats: biggest.slice(0, 6).map(catInfo),
    recent: txSorted().filter((t) => t.type !== 'adjust').slice(0, 7).map((t) => { const c = cat(t.categoryId); return { icon: t.type === 'transfer' ? '🔁' : (c && c.icon) || '🧾', name: t.note || (c ? c.name : 'Transfer'), amount: t.amount, type: t.type }; }) };
}
const itemData = (base, item) => Object.assign({}, base, { cat: base.pickCat(item.cat) }); // each widget has its own category

// What the widgets need besides the pictures: which items exist, where the buttons are, and the iPhone's add form.
function widgetSummary(w) {
  const cats = (kind) => categories(kind, true).slice(0, 24).map((c) => ({ i: c.id, n: shortName(c.name), e: c.icon || '' }));
  const quick = {};
  const items = {};
  widgetIds(w).forEach((id) => {
    const it = w.items[id];
    quick[id] = !!(WidgetArt.DESIGNS[it.design] || {}).buttons;
    items[id] = { s: it.size, c: it.back === 'clear' };
  });
  return { v: 4, quick, items, tap: w.tap, cur: setting('currency') || 'RM',
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

// A canvas as bytes that always fit one Sheet cell: PNG keeps text crisp; a picture background needs JPEG,
// a very detailed one also a lower resolution, and the words layer stays PNG because it has to stay see-through.
function canvasBytes(cv, photo, seeThrough) {
  const fits = (url) => url.length * 0.75 <= WIDGET_IMAGE_BYTES;
  let url = cv.toDataURL('image/png');
  if (!photo && fits(url)) return url;
  for (let zoom = 1; zoom >= 0.4; zoom -= 0.15) {
    const small = document.createElement('canvas');
    small.width = Math.round(cv.width * zoom);
    small.height = Math.round(cv.height * zoom);
    small.getContext('2d').drawImage(cv, 0, 0, small.width, small.height);
    if (seeThrough) {
      url = small.toDataURL('image/png');
      if (fits(url)) return url;
      continue;
    }
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

// Two fingerprints per item. look: anything the person chose. numbers: what it shows.
function itemHashes(id, item, base) {
  const data = Object.assign({}, itemData(base, item), { pickCat: 0 });
  return { l: hashText(JSON.stringify([item, itemPic(id).length, widgetColor(item)])), n: hashText(JSON.stringify(data)) };
}

async function sealedLayer(w, item, data, picture, which) {
  const cv = document.createElement('canvas');
  WidgetArt.paint(cv, item.size, item.design, widgetStyle(item), data, picture, 2, which);
  const url = canvasBytes(cv, item.back === 'picture' && !!picture && which !== 'text', which === 'text');
  return Crypt.wrapKey(url.slice(url.indexOf(',') + 1).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), w.k);
}

// Uploads what changed. New looks always go up; new numbers only for widgets in use, so a big library of saved
// widgets doesn't add to each record's upload. `now` = an item about to go on a Home Screen.
async function uploadWidgets(now) {
  const w = widgetCfg();
  if (!w || CFG.demo) return;
  const base = widgetData();
  const summary = JSON.stringify(widgetSummary(w));
  const sent = M.widgetSent && M.widgetSent.t === w.t && M.widgetSent.v === WIDGET_UPLOAD ? M.widgetSent : { t: w.t, summary: 0, items: {} };
  const hashes = {};
  widgetIds(w).forEach((id) => { hashes[id] = itemHashes(id, w.items[id], base); });
  const changed = widgetIds(w).filter((id) => !sent.items[id] || sent.items[id].l !== hashes[id].l || sent.items[id].n !== hashes[id].n);
  const gone = Object.keys(sent.items).filter((id) => !w.items[id]);
  if (hashText(summary) === sent.summary && !changed.length && !gone.length) return;

  const { used } = await api('widgetPut', { t: w.t, data: await Crypt.sealJson(await Crypt.dataKey(w.k), JSON.parse(summary)) });
  M.widgetUsed = used || {};
  const go = changed.filter((id) => id === now || !sent.items[id] || sent.items[id].l !== hashes[id].l || widgetInUse(id));
  const rows = [];
  for (const id of go) {
    const item = w.items[id];
    const data = itemData(base, item);
    const picture = await loadPic(itemPic(id));
    rows.push({ k: id + 'b', data: await sealedLayer(w, item, data, picture, 'back') }, { k: id + 't', data: await sealedLayer(w, item, data, picture, 'text') });
    if (id === 's' || id === 'm') rows.push({ k: id, data: await sealedLayer(w, item, data, picture, 'all') }); // for scripts and apps from before the layers
  }
  if (rows.length || gone.length) await api('widgetImgs', { t: w.t, rows, drop: gone });
  const items = {};
  widgetIds(w).forEach((id) => { items[id] = go.includes(id) ? hashes[id] : sent.items[id] || hashes[id]; });
  M.widgetSent = { t: w.t, v: WIDGET_UPLOAD, summary: hashText(summary), items };
  persist();
  if (Native) Native.refreshWidgets(); // the Home Screen shows it now, not at the next half hour
}

function pushWidget(now) {
  const run = widgetQueue.then(() => uploadWidgets(now));
  widgetQueue = run.catch(() => {});
  return run;
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

// The previews are the same drawing as the real thing, painted once the screen is on the page.
async function paintWidgetPreviews() {
  const w = widgetCfg();
  const list = $$('canvas[data-item]');
  if (!w || !list.length) return;
  const base = widgetData();
  for (const cv of list) {
    const item = w.items[cv.dataset.item];
    if (!item) continue;
    const picture = await loadPic(itemPic(cv.dataset.item));
    WidgetArt.paint(cv, item.size, cv.dataset.design || item.design, widgetStyle(item), itemData(base, item), picture, Number(cv.dataset.scale) || 1.5);
  }
}

// How big a widget really is on this phone (Apple's sizes by screen width; Android's are close, and vary by phone).
function widgetRealWidth(size) {
  const row = [[428, 170, 364], [414, 169, 360], [390, 158, 338], [375, 155, 329], [0, 141, 292]].find(([from]) => window.innerWidth >= from);
  return size === 's' ? row[1] : row[2];
}

function widgetLibrary(w) {
  const card = (id) => {
    const it = w.items[id];
    return `<button class="wsaved ${it.size}" data-a="go" data-to="widget/${id}" aria-label="Edit ${esc(it.name)}">
      <canvas data-item="${id}" data-scale="1.5"></canvas><b class="ellipsis">${esc(it.name)}</b>
      <span class="meta">${widgetInUse(id) ? 'On a Home Screen' : 'Saved'}</span></button>`;
  };
  return `<section class="card stack"><div class="spread"><h2>My widgets</h2><span class="muted small">${widgetIds(w).length} of ${WIDGET_MAX}</span></div>
      <div class="wlibrary">${widgetIds(w).map(card).join('')}</div>
      <div class="row-btns two"><button class="btn" data-a="widget-new" data-v="s">＋ New Small</button><button class="btn" data-a="widget-new" data-v="m">＋ New Wide</button></div>
      <p class="muted small">Each widget keeps its own layout, colours and picture, and stays here until you delete it, on a Home Screen or not.</p></section>`;
}

function widgetEditor(w, id) {
  const it = w.items[id];
  const usesCat = it.design === 'category';
  const stage = `<section class="wstage" aria-label="Actual size"><canvas class="${it.size}" data-item="${id}" data-scale="3" style="width:${widgetRealWidth(it.size)}px"></canvas><span>Actual size</span></section>`;
  const add = Native ? `<button class="btn primary block" data-a="widget-pin" data-v="${id}">Add to Home Screen</button>`
    : isIOS() ? `<p class="muted small">${id === 's' || id === 'm' ? 'iPhone widgets show this one when their Parameter is empty.' : `To show this on iPhone: touch and hold the widget, tap <b>Edit Widget</b>, and type <b>${esc(id)}</b> under <b>Parameter</b>.`}</p>` : '';
  const layouts = `<section class="card stack"><h2>Layout</h2><div class="wgrid ${it.size}">${WidgetArt.designsFor(it.size).map((d) => `<button class="wdesign ${it.design === d ? 'on' : ''}" data-a="widget-design" data-v="${d}" aria-label="${WidgetArt.DESIGNS[d].name}">
      <canvas data-item="${id}" data-design="${d}" data-scale="1"></canvas><b class="ellipsis">${WidgetArt.DESIGNS[d].name}</b></button>`).join('')}</div></section>`;
  const look = `<section class="card stack"><h2>Customise</h2>
      <label class="field"><span>Name</span><input class="input" maxlength="20" value="${esc(it.name)}" data-change="widget-name"></label>
      <div class="field"><span>Background</span><div class="chips">${WidgetArt.BACKS.map(([b, name]) => `<button class="chip ${it.back === b ? 'on' : ''}" data-a="widget-back" data-v="${b}">${name}</button>`).join('')}</div>
        ${it.back === 'clear' ? '<p class="muted small">Only white words and numbers, so they stay readable on a tinted or clear iPhone Home Screen.</p>' : isIOS() ? '<p class="muted small">Tinted or clear Home Screen? Choose <b>Clear</b>.</p>' : ''}</div>
      ${it.back === 'picture' ? `<div class="pic-btns"><label class="btn file-pick">🖼️ ${itemPic(id) ? 'Change picture' : 'Choose a picture'}<input type="file" accept="image/*" data-change="widget-picture"></label>
        ${itemPic(id) ? '<button class="btn" data-a="widget-picture-clear">Remove</button>' : ''}</div>` : ''}
      ${it.back === 'clear' ? '' : `<div class="field"><span>Colour</span><div class="swatches"><button class="${it.color ? '' : 'on'}" style="background:${Theme.read(setting('theme')).color}" data-a="widget-color" data-v="" aria-label="Same as the app"></button>
        ${Theme.PRESETS.map(([name, c]) => `<button class="${it.color === c ? 'on' : ''}" style="background:${c}" data-a="widget-color" data-v="${c}" aria-label="${name}"></button>`).join('')}</div></div>`}
      ${usesCat ? `<label class="field"><span>Category to show</span><select class="input" data-change="widget-cat"><option value="">Biggest spending</option>
        ${categories('expense').map((c) => `<option value="${esc(c.id)}" ${it.cat === c.id ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <div class="spread"><span>Short amounts (RM4.7k)</span><label class="switch"><input type="checkbox" data-change="widget-short" ${it.short ? 'checked' : ''} aria-label="Short amounts"><i></i></label></div></section>`;
  const manage = `<div class="row-btns two"><button class="btn" data-a="widget-copy">Duplicate</button>${id === 's' || id === 'm' ? '' : '<button class="btn danger" data-a="widget-delete">Delete</button>'}</div>
      ${id === 's' || id === 'm' ? '<p class="muted small center-text">This is the default for widgets that didn’t choose one, so it can be changed but not deleted.</p>' : ''}`;
  return screenHead(esc(it.name), { back: 'widget' }) + stage + add + layouts + look + manage;
}

function widgetScreen() {
  const w = widgetCfg();
  if (w) loadWidgetScript();
  if (w && w.items[view.arg]) return widgetEditor(w, view.arg);
  const head = screenHead('Home Screen widget', { back: 'settings' });
  const toggle = `<section class="card flush"><div class="item"><span class="bubble">📊</span><span class="grow"><span class="title">Widget</span>
      <span class="meta">${CFG.demo ? 'Not in the preview' : 'Your money on the Home Screen. Anyone who sees your Home Screen sees these numbers.'}</span></span>
      <label class="switch"><input type="checkbox" data-change="widget-toggle" ${w ? 'checked' : ''} ${CFG.demo ? 'disabled' : ''} aria-label="Widget"><i></i></label></div></section>`;
  if (!w) return head + toggle;
  const taps = [['app', 'Safari'], ['form', 'Quick form']];
  const iphone = `<section class="card stack"><h2>iPhone</h2><ol class="steps">
      <li><span>Get the free app <a class="link" href="${SCRIPTABLE_APP}" target="_blank" rel="noopener">Scriptable</a> from the App Store.</span></li>
      <li><span>Tap <b>Copy script</b> below.</span></li>
      <li><span>In Scriptable tap <b>＋</b>, paste, name it <b>My Tracker</b> and tap <b>Done</b>.</span></li>
      <li><span>Touch and hold your Home Screen, tap <b>Edit ▸ Add Widget</b>, pick <b>Scriptable</b> and the size you want.</span></li>
      <li><span>Touch and hold the new widget, tap <b>Edit Widget</b>, and choose <b>My Tracker</b> under <b>Script</b>. To show a saved widget, type its number under <b>Parameter</b>: you’ll find it when you open that widget here.</span></li></ol>
      <button class="btn primary block" data-a="widget-copy-script">Copy script</button>
      <div class="field"><span>Tapping the widget on iPhone</span><div class="chips">${taps.map(([v, name]) => `<button class="chip ${w.tap === v ? 'on' : ''}" data-a="widget-tap" data-v="${v}">${name}</button>`).join('')}</div></div>
      <p class="muted small">${{ app: 'iPhones can’t open the Home Screen app from a widget, so this opens My Tracker in Safari, which has its own sign-in.',
    form: 'A quick form with no sign-in. Its records appear when My Tracker next opens.' }[w.tap]}</p>
      <p class="muted small">Add records faster: make a Shortcut with <b>Open URLs</b> and <b>scriptable:///run/My%20Tracker?add=expense</b>, then put it on the Action Button, Back Tap or Siri.</p></section>`;
  const android = `<section class="card stack"><h2>Android</h2><ol class="steps">
      <li><span>Download the My Tracker app, open the file and allow it. The widgets come with it.</span></li>
      <li><span>Sign in there. Your records and widgets come back by themselves.</span></li>
      <li><span>Open a widget in the app and tap <b>Add to Home Screen</b>.</span></li></ol>
      <a class="btn block" href="${ANDROID_APK}" download="My-Tracker.apk">Download My Tracker for Android</a></section>`;
  if (Native) return head + toggle + widgetLibrary(w) + '<p class="muted small center-text">Open a widget to customise it and add it to your Home Screen.</p>';
  const note = '<p class="muted small center-text">The script is like a key to these numbers, so keep it to yourself. Turning the widget off makes it stop working.</p>';
  return head + toggle + widgetLibrary(w) + (isIOS() ? iphone + android : android + iphone) + note;
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

function addItem(item, picture) {
  const w = widgetCfg();
  if (widgetIds(w).length >= WIDGET_MAX) { toast(`You can keep ${WIDGET_MAX} widgets. Delete one first.`); return; }
  const id = String(w.next);
  saveWidgetCfg({ next: w.next + 1, items: Object.assign({}, w.items, { [id]: item }) });
  if (picture) put('settings', { id: 'widgetpic:' + id, value: picture });
  go('widget', id);
}

actions['widget-copy-script'] = () => {
  if (!widgetScript) { loadWidgetScript(); toast('Still loading. Tap again in a moment.'); return; }
  copyText(widgetScript.replace('__WIDGET_CODE__', widgetCode(widgetCfg())), 'Script copied ✓');
};
actions['widget-new'] = (el) => {
  const size = el.dataset.v;
  addItem(Object.assign({ name: `${WidgetArt.SIZES[size].name} ${widgetCfg().next}`, size, design: validDesign(size) }, WIDGET_LOOK));
};
actions['widget-copy'] = () => {
  const id = view.arg;
  const it = widgetCfg().items[id];
  addItem(Object.assign({}, it, { name: shortName(it.name + ' copy') }), itemPic(id));
};
actions['widget-delete'] = async () => {
  const id = view.arg;
  if (!(await confirmSheet('Delete this widget?', 'If it’s on a Home Screen, that widget goes back to the default look.', 'Delete', true))) return;
  const items = Object.assign({}, widgetCfg().items);
  delete items[id];
  saveWidgetCfg({ items });
  if (setting('widgetpic:' + id)) remove('settings', 'widgetpic:' + id);
  go('widget');
};
actions['widget-design'] = (el) => saveItem(view.arg, { design: el.dataset.v });
actions['widget-back'] = (el) => saveItem(view.arg, { back: el.dataset.v });
actions['widget-color'] = (el) => saveItem(view.arg, { color: el.dataset.v });
actions['widget-cat'] = (el) => saveItem(view.arg, { cat: el.value });
actions['widget-short'] = (el) => saveItem(view.arg, { short: el.checked });
actions['widget-name'] = (el) => saveItem(view.arg, { name: shortName(el.value.trim()) || widgetCfg().items[view.arg].name });
actions['widget-tap'] = (el) => saveWidgetCfg({ tap: el.dataset.v });
actions['widget-picture'] = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  try {
    put('settings', { id: 'widgetpic:' + view.arg, value: await widgetPicture(file) });
  } catch (e) {
    toast('That picture couldn’t be opened. Try another one.');
  }
};
actions['widget-picture-clear'] = () => put('settings', { id: 'widgetpic:' + view.arg, value: 'none' });
actions['widget-pin'] = async (el) => {
  const id = el.dataset.v;
  if (!Native.setIcon) { toast('Please update the Android app first: get it from Settings ▸ Home Screen widget in your browser.', 5000); return; }
  el.disabled = true;
  try {
    await pushWidget(id); // the newest look and numbers are there when it lands on the Home Screen
  } catch (e) { /* offline: it shows them after the next sync */ }
  el.disabled = false;
  if (!Native.pinWidget(id, widgetCfg().items[id].size)) toast('Touch and hold your Home Screen, tap Widgets, then pick My Tracker.', 4500);
};

// Off ends the code on every phone, but keeps the library: only the keys go.
actions['widget-toggle'] = async (el) => {
  const w = widgetCfg();
  if (el.checked) {
    saveWidgetCfg({ t: Crypt.newKey(), k: Crypt.newKey() }); // the next sync uploads it
    return;
  }
  if (!(await confirmSheet('Turn the widget off?', 'Widgets on your phones go blank, and their code stops working. Your saved widgets stay here. Turning it on again gives a new code.', 'Turn off', true))) { el.checked = true; return; }
  try {
    await api('widgetOff', { t: w.t });
    saveWidgetCfg({ t: '', k: '', items: w.items, next: w.next, tap: w.tap });
  } catch (e) {
    el.checked = true;
    toast(e.message);
  }
};

SCREENS.widget = widgetScreen;
TAB_OF.widget = 'home';
