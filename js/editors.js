// Bottom-sheet editors: records (with the calculator), accounts, categories, budgets, bills and paying a bill.
'use strict';

const EMOJIS = ['🍜', '🍔', '☕', '🧋', '🍱', '🛒', '🥬', '🚗', '⛽', '🚌', '🚕', '🅿️', '🏠', '💡', '💧', '📱', '🌐', '🛍️', '👗', '💄', '💊', '🏥', '🦷', '🎬',
  '🎮', '🎵', '📚', '🎓', '🛡️', '👨‍👩‍👧', '👶', '🐶', '🎁', '✈️', '🏨', '💳', '🏦', '💰', '💼', '🎉', '💻', '🧧', '↩️', '📦', '🔧', '🧾', '🙏', '💇'];
// Common Malaysian bills, with the category each usually belongs to.
const BILL_IDEAS = [['Rent', 'Rent'], ['TNB electricity', 'Bills'], ['Air (water)', 'Bills'], ['Indah Water', 'Bills'], ['Unifi / Time internet', 'Phone'],
  ['Phone bill', 'Phone'], ['Astro', 'Entertainment'], ['Car loan', 'Loan'], ['House loan', 'Rent'], ['PTPTN', 'Loan'], ['Credit card', 'Loan'],
  ['Insurance / Takaful', 'Insurance'], ['Road tax', 'Transport'], ['Cukai taksiran', 'Rent'], ['Cukai tanah', 'Rent'], ['Netflix', 'Entertainment'], ['Spotify', 'Entertainment']];
const REMIND_BEFORE = [[0, 'On the day'], [1, '1 day before'], [2, '2 days before'], [3, '3 days before'], [7, '1 week before']];

const shake = (el) => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
const sheetState = () => (topSheet() || {})._st;

function sheetHead(title, opts) {
  opts = opts || {};
  return `<div class="sheet-head"><button class="icon-btn plain" data-a="${opts.back ? 'sheet-back' : 'close-sheet'}" aria-label="${opts.back ? 'Back' : 'Close'}">${icon(opts.back ? 'back' : 'close')}</button>
    ${opts.middle || `<h2 class="ellipsis">${title}</h2>`}${opts.right || '<span class="head-space"></span>'}</div>`;
}

// Selects one chip in its group without redrawing the sheet.
function pick(el, attr) {
  $$(`[data-a="${el.dataset.a}"]`, el.closest('.sheet')).forEach((b) => b.classList.toggle('on', b === el));
  return el.dataset[attr || 'v'];
}

function accountChips(action, selected, exclude) {
  const bal = balances();
  return `<div class="chips scroll">${accounts().filter((a) => a.id !== exclude).map((a) => `<button class="chip acc-chip ${a.id === selected ? 'on' : ''}" data-a="${action}" data-v="${a.id}">
    ${accBadge(a)}<span class="ellipsis">${esc(a.name)}</span><span class="num">${amt(bal[a.id])}</span></button>`).join('')}</div>`;
}

// ============================== add / edit a record ==============================
function defaultAccount() {
  const list = accounts();
  return list.find((a) => a.id === M.lastAccount) ? M.lastAccount : list.length ? list[0].id : '';
}

function openTxEditor(id, preset) {
  const old = id ? S.transactions[id] : null;
  if (old && old.type === 'adjust') return openAdjustInfo(old);
  if (!accounts().length) {
    toast('First, add the account the money goes in or out of.');
    return openAccountEditor();
  }
  preset = preset || {};
  const st = old ? Object.assign({}, old, { expr: Calc.fromNumber(old.amount) })
    : { type: preset.type === 'transfer' ? 'transfer' : 'expense', expr: '', accountId: preset.acc && acc(preset.acc) ? preset.acc : defaultAccount(), toAccountId: '',
      categoryId: '', date: Shared.isDate(preset.date) ? preset.date : today(), note: '' };
  const seg = `<div class="seg type">${[['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']]
    .map(([v, l]) => `<button class="${st.type === v ? 'on' : ''}" data-a="tx-type" data-v="${v}">${l}</button>`).join('')}</div>`;
  const sh = openSheet(sheetHead('', { middle: seg, right: old ? `<button class="icon-btn plain" data-a="tx-delete" aria-label="Delete">${icon('trash')}</button>` : '' }) +
    '<div class="sheet-body"></div>' + keypadHTML(`${icon('check')} Save`), { cls: 'full' });
  sh._st = st;
  drawTx(sh);
  sh._key = (k) => {
    if (k === 'ok') return saveTx(sh);
    st.expr = Calc.press(st.expr, k);
    $('.amount-box', sh).innerHTML = amountBoxHTML(st.expr, st.type);
  };
}

function drawTx(sh) {
  const st = sh._st;
  let body = `<div class="amount-box">${amountBoxHTML(st.expr, st.type)}</div>`;
  if (st.type === 'transfer') {
    body += `<div class="field"><span>From</span>${accountChips('tx-acc', st.accountId)}</div>
      <div class="field"><span>To</span>${accountChips('tx-to', st.toAccountId)}</div>`;
  } else {
    const cats = categories(st.type, true);
    body += `<div class="field"><span>Category</span><div class="cat-grid">${cats.map((c) => `<button class="cat ${c.id === st.categoryId ? 'on' : ''}" data-a="tx-cat" data-v="${c.id}">
      <span class="e">${esc(c.icon)}</span><span class="cname">${esc(c.name)}</span></button>`).join('')}</div></div>
      <div class="field"><span>${st.type === 'income' ? 'Into' : 'From'} account</span>${accountChips('tx-acc', st.accountId)}</div>`;
  }
  const t = today();
  const y = Shared.addDays(t, -1);
  body += `<div class="field"><span>Date</span><div class="chips">
      <button class="chip ${st.date === t ? 'on' : ''}" data-a="tx-date" data-v="${t}">Today</button>
      <button class="chip ${st.date === y ? 'on' : ''}" data-a="tx-date" data-v="${y}">Yesterday</button>
      <input type="date" class="chip date-chip ${st.date !== t && st.date !== y ? 'on' : ''}" value="${st.date}" max="${Shared.addDays(t, 366)}" data-change="tx-date-pick" aria-label="Pick a date">
    </div></div>
    <input class="input" placeholder="Note (optional)" maxlength="200" value="${esc(st.note)}" data-input="tx-note" enterkeyhint="done">`;
  $('.sheet-body', sh).innerHTML = body;
  const on = $('.cat.on', sh);
  if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}

actions['tx-type'] = (el) => {
  const sh = topSheet();
  const st = sh._st;
  const v = pick(el);
  if (v === st.type) return;
  st.type = v;
  st.categoryId = '';
  if (v === 'transfer' && (!st.toAccountId || st.toAccountId === st.accountId)) st.toAccountId = '';
  drawTx(sh);
};
actions['tx-cat'] = (el) => { sheetState().categoryId = pick(el); };
actions['tx-acc'] = (el) => { sheetState().accountId = pick(el); };
actions['tx-to'] = (el) => { sheetState().toAccountId = pick(el); };
actions['tx-date'] = (el) => {
  sheetState().date = pick(el);
  const input = $('input[type=date]', topSheet());
  input.classList.remove('on');
  input.value = el.dataset.v;
};
actions['tx-date-pick'] = (el) => {
  if (!Shared.isDate(el.value)) return;
  sheetState().date = el.value;
  $$('[data-a="tx-date"]', topSheet()).forEach((b) => b.classList.toggle('on', b.dataset.v === el.value));
  el.classList.toggle('on', !$('[data-a="tx-date"].on', topSheet()));
};
actions['tx-note'] = (el) => { sheetState().note = el.value; };

function saveTx(sh) {
  const st = sh._st;
  const amount = Calc.evaluate(st.expr);
  const box = $('.amount-box', sh);
  if (!amount || amount <= 0) { shake(box); return toast('Type the amount first'); }
  if (st.type !== 'transfer' && !st.categoryId) { shake($('.cat-grid', sh)); return toast('Pick a category'); }
  if (!st.accountId || !acc(st.accountId)) return toast('Pick an account');
  if (st.type === 'transfer' && (!st.toAccountId || st.toAccountId === st.accountId)) return toast('Pick a different account to move the money to');
  const rec = put('transactions', {
    id: st.id || uid(), date: st.date, type: st.type, amount, accountId: st.accountId,
    toAccountId: st.type === 'transfer' ? st.toAccountId : '', categoryId: st.type === 'transfer' ? '' : st.categoryId, note: (st.note || '').trim().slice(0, 200),
  });
  M.lastAccount = st.accountId;
  closeSheet();
  const c = cat(rec.categoryId);
  let msg = `Saved ✓ ${money(amount)}${c ? ' · ' + c.name : ''}`;
  if (rec.type === 'expense' && c && c.budget > 0) {
    const b = budgetOf(c, rec.date.slice(0, 7));
    if (b.level === 'over') msg = `❗ ${c.name} is over budget by ${money(-b.left)}`;
    else if (b.level === 'warn') msg = `⚠️ ${c.name}: ${Math.round(b.pct * 100)}% of budget used`;
  }
  toast(msg, msg.startsWith('Saved') ? 2000 : 3800);
}

actions['tx-delete'] = async () => {
  const st = sheetState();
  if (await confirmSheet('Delete this record?', `${money(Calc.evaluate(st.expr))} on ${fmtDate(st.date)}`, 'Delete', true)) {
    remove('transactions', st.id);
    closeSheet();
    toast('Deleted');
  }
};

function openAdjustInfo(t) {
  const sh = openSheet(sheetHead('Balance correction') + `<div class="sheet-body center-text">
    <div class="amount-box center-text"><div class="amt num">${money(t.amount, { plus: true })}</div></div>
    <p class="muted">${esc((acc(t.accountId) || {}).name || '')} · ${fmtDate(t.date, true)}</p>
    <p class="muted small">Added by “Fix balance” so the app matches the bank.</p></div>
    <div class="sheet-foot"><button class="btn danger block" data-a="adjust-delete">Delete correction</button></div>`);
  sh._st = t;
}
actions['adjust-delete'] = () => { remove('transactions', sheetState().id); closeSheet(); toast('Deleted'); };

actions.add = (el) => openTxEditor(null, { acc: el.dataset.acc, date: el.dataset.date, type: el.dataset.type });
actions['edit-tx'] = (el) => openTxEditor(el.dataset.id);

// ============================== accounts ==============================
// New: 1) kind  2) bank / e-wallet (if the kind has a list)  3) details. Editing goes straight to 3.
function openAccountEditor(id) {
  if (id) return openAccountForm(Object.assign({ last4: '', note: '', provider: '', excluded: false }, S.accounts[id]), false);
  openSheet(sheetHead('New account') + `<div class="sheet-body"><p class="muted">What kind of account?</p><section class="card flush">${KIND_ORDER.map((k) => `<button class="item" data-a="acc-kind" data-v="${k}">
    <span class="bubble">${KINDS[k].emoji}</span><span class="grow"><span class="title ellipsis">${KINDS[k].label}</span><span class="meta ellipsis">${KINDS[k].hint}</span></span>${icon('next')}</button>`).join('')}</section></div>`, { cls: 'full' });
}

function newAccount(kind, key) {
  const p = provider(key);
  let name = p ? p.name : kind === 'cash' ? 'Cash' : '';
  if (p && kind === 'card') name = p.name + ' credit card';
  if (p && kind === 'savings' && (PROVIDERS_FOR.bank.indexOf(key) >= 0 || p.kind === 'bank')) name = p.name + ' fixed deposit';
  const n = accounts(true).length;
  return { id: uid(), name, type: kind, provider: p ? key : '', opening: 0, color: p ? p.color : CARD_COLORS[n % CARD_COLORS.length], order: n,
    archived: false, excluded: false, last4: '', note: '' };
}

// What a kind's list is called, for "Add a bank" and so on.
const PROVIDER_NOUN = { bank: 'bank', card: 'bank', savings: 'provider', ewallet: 'e-wallet', prepaid: 'card', paylater: 'PayLater' };

actions['acc-kind'] = (el) => {
  const kind = el.dataset.v;
  if (!PROVIDERS_FOR[kind]) { closeSheet(); openAccountForm(newAccount(kind, ''), true); return; }
  const sh = openSheet(sheetHead('Choose', { back: true }) + '<div class="sheet-body"></div>', { cls: 'full' });
  sh._kind = kind;
  drawProviders(sh);
};
// The built-in list, then the user's own (with a pencil to fix them), then "add one that's not listed".
function drawProviders(sh) {
  const kind = sh._kind;
  const noun = PROVIDER_NOUN[kind];
  const row = (p) => `${accBadge({ provider: p.key })}<span class="grow"><span class="title ellipsis">${esc(p.name)}</span></span>`;
  const own = ownProviders(kind);
  $('.sheet-body', sh).innerHTML = `<p class="muted">${KINDS[kind].label}</p><section class="card flush">
    ${PROVIDERS_FOR[kind].map((k) => `<button class="item" data-a="acc-provider" data-v="${k}">${row(provider(k))}${icon('next')}</button>`).join('')}
    ${own.map((p) => `<div class="item split"><button class="pick" data-a="acc-provider" data-v="${esc(p.key)}">${row(p)}</button>
      <button class="icon-btn plain" data-a="bank-edit" data-v="${esc(p.key)}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</button></div>`).join('')}
    <button class="item" data-a="bank-new"><span class="logo emoji">➕</span><span class="grow"><span class="title">Add another ${noun}</span>
      <span class="meta ellipsis">Not listed? Add it with its logo</span></span>${icon('next')}</button>
    </section>`;
}
actions['sheet-back'] = () => closeSheet();
actions['acc-provider'] = (el) => {
  const kind = topSheet()._kind;
  closeAllSheets();
  openAccountForm(newAccount(kind, el.dataset.v), true);
};

// ============================== banks the user adds ==============================
// Saved in settings as 'bank:<id>', so it syncs and shows up in the list next time.
function openBankEditor(key, kind) {
  const c = key ? setting(key) : null;
  const st = c ? { key, name: c.name || '', color: provider(key).color, logo: provider(key).logo, kind: c.kind }
    : { key: 'bank:' + uid(), name: '', color: CARD_COLORS[ownProviders(kind).length % CARD_COLORS.length], logo: '', kind };
  const noun = PROVIDER_NOUN[st.kind] || 'bank';
  const sh = openSheet(sheetHead(c ? `Edit ${noun}` : `Add a ${noun}`, { back: true }) + '<div class="sheet-body"></div>' +
    `<div class="sheet-foot"><button class="btn primary block" data-a="bank-save">${c ? 'Save' : 'Add and use it'}</button></div>`, { cls: 'full' });
  sh._st = st;
  sh._isNew = !c;
  sh._from = kind || st.kind; // the list it was added from
  drawBank(sh);
}
function drawBank(sh) {
  const st = sh._st;
  const noun = PROVIDER_NOUN[st.kind] || 'bank';
  $('.sheet-body', sh).innerHTML = `<div class="bank-preview">${bankBadge(st)}<b class="ellipsis">${esc(st.name || 'Name')}</b></div>
    <section class="card form-rows">
      <label class="frow"><span>Name</span><input id="bank-name" maxlength="30" placeholder="${noun === 'e-wallet' ? 'e.g. WeChat Pay' : 'e.g. Bank of China'}" value="${esc(st.name)}" data-input="bank-name"></label>
    </section>
    <div class="field"><span>Logo</span>
      <div class="pic-btns"><label class="btn file-pick">🖼️ ${st.logo ? 'Change picture' : 'Choose a picture'}<input type="file" accept="image/*" data-change="bank-logo"></label>
        ${st.logo ? '<button class="btn" data-a="bank-logo-clear">Remove</button>' : ''}</div>
      <span class="help">A screenshot of the bank’s app icon works well. Without one, its initials are shown.</span></div>
    <div class="field"><span>Colour</span><div class="swatches">${CARD_COLORS.concat(CARD_COLORS.indexOf(st.color) < 0 ? [st.color] : []).map((c) => `<button class="${st.color === c ? 'on' : ''}" style="background:${c}" data-a="bank-color" data-v="${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
    ${sh._isNew ? '' : '<button class="btn danger block" data-a="bank-delete">Delete</button>'}`;
}
function bankBadge(st) {
  if (st.logo) return `<span class="logo big pic"><img src="${esc(st.logo)}" alt=""></span>`;
  return `<span class="logo big" style="background:${st.color};color:${inkOn(st.color)}"><span>${esc(initialsOf(st.name || '?'))}</span></span>`;
}
const redrawBankPreview = () => { const sh = topSheet(); $('.bank-preview', sh).innerHTML = bankBadge(sh._st) + `<b class="ellipsis">${esc(sh._st.name || 'Name')}</b>`; };

// A picture becomes a small square (cropped to the middle), so it syncs quickly.
function squarePicture(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, size, size);
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('bad picture'));
    const reader = new FileReader(); // a data: URL, because the page's security policy doesn't allow blob: images
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(new Error('bad picture'));
    reader.readAsDataURL(file);
  });
}

actions['bank-new'] = () => openBankEditor('', topSheet()._kind);
actions['bank-edit'] = (el) => openBankEditor(el.dataset.v);
actions['bank-name'] = (el) => { sheetState().name = el.value; redrawBankPreview(); };
actions['bank-color'] = (el) => { sheetState().color = pick(el); redrawBankPreview(); };
actions['bank-logo'] = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  const sh = topSheet();
  try { sh._st.logo = await squarePicture(file, 96); } catch (e) { return toast('That picture couldn’t be opened'); }
  drawBank(sh);
};
actions['bank-logo-clear'] = () => { const sh = topSheet(); sh._st.logo = ''; drawBank(sh); };
actions['bank-save'] = () => {
  const sh = topSheet();
  const st = sh._st;
  st.name = st.name.trim();
  if (!st.name) { shake($('#bank-name', sh)); return toast('Type its name'); }
  const same = (p) => p.key !== st.key && p.name.toLowerCase() === st.name.toLowerCase();
  const builtIn = (PROVIDERS_FOR[st.kind] || []).map(provider).find(same);
  if (builtIn) return toast(`${builtIn.name} is already in the list`);
  if (ownProviders(st.kind).some(same)) return toast('You already added that one');
  put('settings', { id: st.key, value: { name: st.name, color: st.color, logo: st.logo, kind: st.kind } });
  if (sh._isNew) {
    closeAllSheets();
    openAccountForm(newAccount(sh._from, st.key), true);
    return;
  }
  closeSheet();
  drawProviders(topSheet());
  toast('Saved ✓');
};
actions['bank-delete'] = async () => {
  const st = sheetState();
  const users = accounts(true).filter((a) => a.provider === st.key);
  if (users.length) return confirmSheet('It’s in use', `${users.map((a) => a.name).join(', ')} ${users.length > 1 ? 'use' : 'uses'} it. Delete or change ${users.length > 1 ? 'those accounts' : 'that account'} first.`, 'OK');
  if (!(await confirmSheet(`Delete ${st.name}?`, 'It’s taken off the list.', 'Delete', true))) return;
  remove('settings', st.key);
  closeSheet();
  drawProviders(topSheet());
};

function openAccountForm(st, isNew) {
  const sh = openSheet(sheetHead(isNew ? 'New account' : 'Edit account') + '<div class="sheet-body"></div>' +
    `<div class="sheet-foot"><button class="btn primary block" data-a="acc-save">${isNew ? 'Add account' : 'Save'}</button></div>`, { cls: 'full' });
  sh._st = st;
  sh._isNew = isNew;
  drawAccount(sh);
}

function accountPreview(sh) {
  const st = sh._st;
  const bal = sh._isNew ? st.opening : balances()[st.id] + (st.opening - (S.accounts[st.id] || st).opening);
  return cardFace(Object.assign({}, st, { name: st.name || 'Account name' }), bal, { big: true, tag: 'div' });
}

function drawAccount(sh) {
  const st = sh._st;
  const owed = isDebt(st);
  const p = provider(st.provider);
  const colors = (p && CARD_COLORS.indexOf(p.color) < 0 ? [p.color] : []).concat(CARD_COLORS);
  const showLast4 = ['bank', 'card', 'savings', 'prepaid', 'ewallet'].indexOf(st.type) >= 0;
  const people = st.type === 'lent' || st.type === 'borrowed';
  $('.sheet-body', sh).innerHTML = `<div id="acc-preview">${accountPreview(sh)}</div>
    <div class="field"><span>Type</span><div class="chips scroll">${KIND_ORDER.map((k) => `<button class="chip ${st.type === k ? 'on' : ''}" data-a="acc-type" data-v="${k}">${KINDS[k].emoji} ${KINDS[k].label}</button>`).join('')}</div></div>
    <section class="card form-rows">
      <label class="frow"><span>${people ? 'Who' : 'Name'}</span><input id="acc-name" maxlength="40" placeholder="${people ? 'e.g. Mei' : 'e.g. Maybank savings'}" value="${esc(st.name)}" data-input="acc-name"></label>
      ${showLast4 ? `<label class="frow"><span>Last 4 digits</span><input inputmode="numeric" maxlength="4" placeholder="Optional" value="${esc(st.last4)}" data-input="acc-last4"></label>` : ''}
      <label class="frow"><span>Note</span><input maxlength="60" placeholder="Optional" value="${esc(st.note)}" data-input="acc-note"></label>
    </section>
    <div class="field"><span>${owed ? (sh._isNew ? 'Amount owed now' : 'Starting amount owed') : (sh._isNew ? 'Balance right now' : 'Starting balance')}</span>
      <button class="amount-btn num" data-a="acc-opening"><span class="ellipsis">${money(owed ? -st.opening : st.opening)}</span><span class="hint">🧮 Change</span></button>
      ${!sh._isNew ? '<span class="help">The balance before your first record here. To match the bank today, use “Fix balance” on the account’s page.</span>' : ''}</div>
    <div class="field"><span>Card colour</span><div class="swatches">${colors.map((c) => `<button class="${st.color === c ? 'on' : ''}" style="background:${c}" data-a="acc-color" data-v="${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
    <section class="card flush">
      <div class="item"><span class="grow"><span class="title">Count in net worth</span><span class="meta">Include this balance in your totals</span></span>
        <label class="switch"><input type="checkbox" ${st.excluded ? '' : 'checked'} data-change="acc-excluded" aria-label="Count in net worth"><i></i></label></div>
      <div class="item"><span class="grow"><span class="title">Show when adding records</span><span class="meta">Off hides it, but keeps its history</span></span>
        <label class="switch"><input type="checkbox" ${st.archived ? '' : 'checked'} data-change="acc-archive" aria-label="Show when adding records"><i></i></label></div>
    </section>
    ${!sh._isNew ? '<button class="btn danger block" data-a="acc-delete">Delete account</button>' : ''}`;
}
const refreshPreview = () => { const sh = topSheet(); $('#acc-preview', sh).innerHTML = accountPreview(sh); };

actions['acc-name'] = (el) => { sheetState().name = el.value; refreshPreview(); };
actions['acc-last4'] = (el) => { el.value = el.value.replace(/\D/g, '').slice(0, 4); sheetState().last4 = el.value; refreshPreview(); };
actions['acc-note'] = (el) => { sheetState().note = el.value; refreshPreview(); };
actions['acc-type'] = (el) => {
  const st = sheetState();
  const was = isDebt(st);
  st.type = pick(el);
  if (was !== isDebt(st)) st.opening = -st.opening;
  drawAccount(topSheet());
};
actions['acc-color'] = (el) => { sheetState().color = pick(el); refreshPreview(); };
actions['acc-archive'] = (el) => { sheetState().archived = !el.checked; refreshPreview(); };
actions['acc-excluded'] = (el) => { sheetState().excluded = !el.checked; refreshPreview(); };
actions['acc-opening'] = async () => {
  const sh = topSheet();
  const st = sh._st;
  const owed = isDebt(st);
  const v = await askAmount(owed ? 'Amount owed' : 'Balance', Math.abs(st.opening), { allowZero: true });
  if (v === null) return;
  st.opening = owed ? -v : v;
  drawAccount(sh);
};
actions['acc-save'] = () => {
  const sh = topSheet();
  const st = sh._st;
  st.name = (st.name || '').trim();
  if (!st.name) { shake($('#acc-name', sh)); return toast(st.type === 'lent' || st.type === 'borrowed' ? 'Type who it’s with' : 'Give the account a name'); }
  if (accounts(true).some((a) => a.id !== st.id && a.name.toLowerCase() === st.name.toLowerCase())) return toast('You already have an account with that name');
  put('accounts', st);
  closeSheet();
  toast(sh._isNew ? `Added ${st.name} ✓` : 'Saved ✓');
};
actions['acc-delete'] = async () => {
  const st = sheetState();
  if (live('transactions').some((t) => t.accountId === st.id || t.toAccountId === st.id)) {
    return confirmSheet('This account has records', 'To keep your history, switch off “Show when adding records” instead. Delete its records first if you really want to delete it.', 'OK');
  }
  if (await confirmSheet(`Delete ${st.name}?`, '', 'Delete', true)) {
    remove('accounts', st.id);
    closeSheet();
    if (view.route === 'account') go('wallet');
  }
};
actions['acc-new'] = () => openAccountEditor();
actions['acc-edit'] = (el) => openAccountEditor(el.dataset.id);

actions['acc-adjust'] = async (el) => {
  const a = acc(el.dataset.id);
  const cur = balances()[a.id];
  const owed = isDebt(a);
  const v = await askAmount(owed ? 'Amount owed now' : 'Actual balance', Math.abs(cur), { allowZero: true, ok: 'Fix',
    note: `What does ${a.name} show right now? A correction for the difference is added today.` });
  if (v === null) return;
  const diff = Calc.round2((owed ? -v : v) - cur);
  if (!diff) return toast('Already matches ✓');
  put('transactions', { id: uid(), date: today(), type: 'adjust', amount: diff, accountId: a.id, toAccountId: '', categoryId: '', note: 'Balance correction' });
  toast(`Fixed ✓ ${money(diff, { plus: true })}`);
};

// ============================== categories & budgets ==============================
function openCategoryEditor(id, kind) {
  const c = id ? S.categories[id] : null;
  const st = c ? Object.assign({}, c) : { id: uid(), name: '', kind: kind || 'expense', icon: '📦', budget: 0, order: 100 + live('categories').length, archived: false };
  const sh = openSheet(sheetHead(c ? 'Edit category' : 'New category') + '<div class="sheet-body"></div>' +
    `<div class="sheet-foot"><button class="btn primary block" data-a="cat-save">Save</button></div>`, { cls: 'full' });
  sh._st = st;
  sh._isNew = !c;
  drawCategory(sh);
}

function drawCategory(sh) {
  const st = sh._st;
  let body = `<div class="row"><span class="bubble big">${esc(st.icon)}</span>
      <label class="field grow"><span>Name</span><input class="input" id="cat-name" maxlength="30" value="${esc(st.name)}" data-input="cat-name" placeholder="e.g. Coffee"></label></div>
    <div class="field"><span>Icon</span><div class="emoji-grid">${EMOJIS.map((e) => `<button class="${st.icon === e ? 'on' : ''}" data-a="cat-icon" data-v="${e}">${e}</button>`).join('')}</div></div>`;
  if (st.kind === 'expense') {
    body += `<div class="field"><span>Monthly budget</span><button class="amount-btn num" data-a="cat-budget"><span class="ellipsis">${st.budget > 0 ? money(st.budget) : 'No budget'}</span><span class="hint">🧮 Change</span></button></div>`;
  }
  if (!sh._isNew) {
    body += `<section class="card flush"><div class="item"><span class="grow"><span class="title">Hide this category</span><span class="meta">Keeps old records; hides it when adding new ones</span></span>
      <label class="switch"><input type="checkbox" ${st.archived ? 'checked' : ''} data-change="cat-archive" aria-label="Hide"><i></i></label></div></section>`;
  }
  $('.sheet-body', sh).innerHTML = body;
}
actions['cat-name'] = (el) => { sheetState().name = el.value; };
actions['cat-icon'] = (el) => {
  const st = sheetState();
  st.icon = pick(el);
  $('.bubble', topSheet()).textContent = st.icon;
};
actions['cat-archive'] = (el) => { sheetState().archived = el.checked; };
actions['cat-budget'] = async () => {
  const sh = topSheet();
  const v = await askAmount('Monthly budget', sh._st.budget, { allowZero: true, note: 'Set 0 for no budget.' });
  if (v === null) return;
  sh._st.budget = v;
  drawCategory(sh);
};
actions['cat-save'] = () => {
  const sh = topSheet();
  const st = sh._st;
  st.name = (st.name || '').trim();
  if (!st.name) { shake($('#cat-name', sh)); return toast('Give the category a name'); }
  put('categories', st);
  closeSheet();
  toast('Saved ✓');
};
actions['cat-new'] = () => openCategoryEditor(null, view.catKind);
actions['cat-edit'] = (el) => openCategoryEditor(el.dataset.id);
actions['cat-move'] = (el) => {
  const list = live('categories').filter((c) => c.kind === view.catKind).sort((a, b) => (a.archived - b.archived) || (a.order || 0) - (b.order || 0));
  const i = list.findIndex((c) => c.id === el.dataset.id);
  const j = i + Number(el.dataset.d);
  if (i < 0 || j < 0 || j >= list.length) return;
  list.splice(j, 0, list.splice(i, 1)[0]);
  list.forEach((c, k) => { if ((c.order || 0) !== k) put('categories', Object.assign({}, c, { order: k })); });
};
actions['set-budget'] = async (el) => {
  const c = cat(el.dataset.id);
  const v = await askAmount(`${c.icon} ${c.name} budget`, c.budget, { allowZero: true, note: 'How much a month? Set 0 for no budget.' });
  if (v === null) return;
  put('categories', Object.assign({}, c, { budget: v }));
  toast(v ? `Budget set: ${money(v)} a month` : 'Budget removed');
};

// ============================== bills ==============================
function openBillEditor(id) {
  const r = id ? S.reminders[id] : null;
  const st = r ? Object.assign({ auto: false }, r) : { id: uid(), title: '', amount: 0, due: Shared.addDays(today(), 7), repeat: 'month', before: 3, time: '09:00',
    active: true, day: 0, accountId: '', categoryId: '', note: '', lastPaid: '', auto: false };
  const sh = openSheet(sheetHead(r ? 'Edit bill' : 'New bill', { right: r ? `<button class="icon-btn plain" data-a="bill-delete" aria-label="Delete">${icon('trash')}</button>` : '' }) +
    '<div class="sheet-body"></div>' + `<div class="sheet-foot"><button class="btn primary block" data-a="bill-save">Save</button></div>`, { cls: 'full' });
  sh._st = st;
  sh._isNew = !r;
  drawBill(sh);
}

function drawBill(sh) {
  const st = sh._st;
  const cats = categories('expense');
  let body = `<label class="field"><span>What’s the bill?</span><input class="input" id="bill-title" maxlength="60" placeholder="e.g. Rent" value="${esc(st.title)}" data-input="bill-title"></label>`;
  if (sh._isNew) body += `<div class="chips">${BILL_IDEAS.map(([t]) => `<button class="chip" data-a="bill-idea" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  body += `<div class="field"><span>Amount</span><button class="amount-btn num" data-a="bill-amount"><span class="ellipsis">${st.amount ? money(st.amount) : 'Not set'}</span><span class="hint">🧮 Change</span></button></div>
    <label class="field"><span>${st.active ? 'Next due date' : 'Due date'}</span><input class="input" type="date" value="${st.due}" data-change="bill-due"></label>
    <div class="field"><span>Repeats</span><div class="chips">${Object.keys(Shared.REPEATS).map((k) => `<button class="chip ${st.repeat === k ? 'on' : ''}" data-a="bill-repeat" data-v="${k}">${Shared.REPEATS[k].label}</button>`).join('')}</div></div>
    <div class="field"><span>Remind me</span><div class="chips">${REMIND_BEFORE.map(([d, l]) => `<button class="chip ${Number(st.before) === d ? 'on' : ''}" data-a="bill-before" data-v="${d}">${l}</button>`).join('')}</div></div>
    <label class="field"><span>At what time</span><input class="input" type="time" value="${esc(st.time)}" data-change="bill-time"></label>
    <div class="field"><span>Paid from</span>${accounts().length ? accountChips('bill-acc', st.accountId) : '<span class="help">Add an account first.</span>'}</div>
    <label class="field"><span>Category when paid</span><select class="input" data-change="bill-cat"><option value="">Choose…</option>
      ${cats.map((c) => `<option value="${c.id}" ${c.id === st.categoryId ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></label>
    <section class="card flush"><div class="item"><span class="grow"><span class="title">Record automatically</span>
      <span class="meta">On the due date, add the payment from the account above (good for auto-debit and subscriptions)</span></span>
      <label class="switch"><input type="checkbox" ${st.auto ? 'checked' : ''} data-change="bill-auto" aria-label="Record automatically"><i></i></label></div></section>`;
  if (!sh._isNew && !st.active) body += `<button class="btn block" data-a="bill-reactivate">Start reminding again</button>`;
  $('.sheet-body', sh).innerHTML = body;
}

actions['bill-title'] = (el) => { sheetState().title = el.value; };
actions['bill-idea'] = (el) => {
  const st = sheetState();
  st.title = el.dataset.v;
  const idea = BILL_IDEAS.find(([t]) => t === st.title);
  const c = idea && categories('expense').find((x) => x.name.indexOf(idea[1]) === 0);
  if (c) st.categoryId = c.id;
  if (/Road tax|Cukai|Insurance/.test(st.title)) st.repeat = /taksiran/.test(st.title) ? '6month' : 'year';
  drawBill(topSheet());
};
actions['bill-amount'] = async () => {
  const sh = topSheet();
  const v = await askAmount('Bill amount', sh._st.amount, { allowZero: true });
  if (v === null) return;
  sh._st.amount = v;
  drawBill(sh);
};
actions['bill-due'] = (el) => { if (Shared.isDate(el.value)) sheetState().due = el.value; };
actions['bill-repeat'] = (el) => { sheetState().repeat = pick(el); };
actions['bill-before'] = (el) => { sheetState().before = Number(pick(el)); };
actions['bill-time'] = (el) => { if (/^\d{2}:\d{2}$/.test(el.value)) sheetState().time = el.value; };
actions['bill-acc'] = (el) => {
  const st = sheetState();
  st.accountId = st.accountId === el.dataset.v ? '' : el.dataset.v; // tap again to clear
  $$('[data-a="bill-acc"]', topSheet()).forEach((b) => b.classList.toggle('on', b.dataset.v === st.accountId));
};
actions['bill-cat'] = (el) => { sheetState().categoryId = el.value; };
actions['bill-auto'] = (el) => { sheetState().auto = el.checked; };
actions['bill-reactivate'] = () => { sheetState().active = true; drawBill(topSheet()); toast('Check the due date, then Save'); };
actions['bill-save'] = () => {
  const sh = topSheet();
  const st = sh._st;
  st.title = (st.title || '').trim();
  if (!st.title) { shake($('#bill-title', sh)); return toast('Give the bill a name'); }
  if (!Shared.isDate(st.due)) return toast('Pick a due date');
  if (st.auto && (!st.amount || !acc(st.accountId))) return toast('To record automatically, set the amount and the account it’s paid from', 3500);
  const old = S.reminders[st.id];
  if (!old || old.due !== st.due || !st.day) st.day = +st.due.slice(8);
  put('reminders', st);
  closeSheet();
  const made = autoRecordBills();
  toast(made ? `Saved ✓ ${made} payment(s) recorded` : `Saved ✓ Due ${Shared.relDays(Shared.daysBetween(today(), S.reminders[st.id].due))}`);
  if (sh._isNew && pushState() === 'default' && !CFG.demo) setTimeout(() => toast('Tip: turn on notifications at the top of Bills', 3500), 2300);
};
actions['bill-delete'] = async () => {
  const st = sheetState();
  if (await confirmSheet(`Delete “${st.title}”?`, 'Its reminders stop. Records you already made stay.', 'Delete', true)) {
    remove('reminders', st.id);
    closeSheet();
  }
};
actions['bill-new'] = () => openBillEditor();
actions['bill-edit'] = (el) => openBillEditor(el.dataset.id);
actions['toggle-done'] = () => { view.showDone = !view.showDone; render(); };

// Paying a bill: optionally records the spending, then moves the bill to its next due date.
function billsCategory(r) {
  if (r.categoryId && cat(r.categoryId)) return r.categoryId;
  const c = categories('expense').find((x) => /^Bills/.test(x.name)) || categories('expense').find((x) => /^Others/.test(x.name));
  return c ? c.id : '';
}

actions['bill-pay'] = (el) => {
  const r = S.reminders[el.dataset.id];
  const st = { id: r.id, amount: Number(r.amount) || 0, accountId: r.accountId && acc(r.accountId) ? r.accountId : defaultAccount(), record: accounts().length > 0, date: today() };
  const next = Shared.nextDue(r);
  const c = cat(billsCategory(r));
  const sh = openSheet(sheetHead('Pay bill') + `<div class="sheet-body">
      <div class="center-text"><h2>${esc(r.title)}</h2><p class="muted small">Due ${fmtDate(r.due, true)}${next ? ' · then next on ' + fmtDate(next, true) : ''}</p></div>
      <div class="field"><span>Amount paid</span><button class="amount-btn num" data-a="pay-amount"><span class="ellipsis">${money(st.amount)}</span><span class="hint">🧮 Change</span></button></div>
      ${accounts().length ? `<section class="card flush"><div class="item"><span class="grow"><span class="title">Record as spending</span>
        <span class="meta ellipsis">${c ? esc(c.icon) + ' ' + esc(c.name) : ''}</span></span><label class="switch"><input type="checkbox" checked data-change="pay-record" aria-label="Record as spending"><i></i></label></div></section>
      <div class="field" id="pay-acc"><span>Paid from</span>${accountChips('pay-acc', st.accountId)}</div>` : ''}
    </div><div class="sheet-foot"><button class="btn primary block" data-a="pay-save">${icon('check')} Mark as paid</button></div>`);
  sh._st = st;
};
actions['pay-amount'] = async (el) => {
  const st = sheetState();
  const v = await askAmount('Amount paid', st.amount, { allowZero: true });
  if (v === null) return;
  st.amount = v;
  $('.ellipsis', el).textContent = money(v);
};
actions['pay-record'] = (el) => { sheetState().record = el.checked; $('#pay-acc', topSheet()).hidden = !el.checked; };
actions['pay-acc'] = (el) => { sheetState().accountId = pick(el); };
actions['pay-save'] = () => {
  const st = sheetState();
  const r = S.reminders[st.id];
  if (st.record && !st.amount) return toast('Type the amount paid, or switch off “Record as spending”');
  if (st.record) {
    put('transactions', { id: uid(), date: st.date, type: 'expense', amount: st.amount, accountId: st.accountId, toAccountId: '', categoryId: billsCategory(r), note: r.title });
    M.lastAccount = st.accountId;
  }
  const next = Shared.nextDue(r);
  put('reminders', Object.assign({}, r, { lastPaid: st.date, due: next || r.due, active: !!next, amount: r.amount || st.amount }));
  closeSheet();
  toast(next ? `Paid ✓ Next due ${fmtDate(next)}` : 'Paid ✓');
};
