// Bottom-sheet editors: records (with the calculator), accounts, categories, budgets, bills and paying a bill.
'use strict';

const BANKS = [['Maybank', 'bank'], ['CIMB', 'bank'], ['Public Bank', 'bank'], ['RHB', 'bank'], ['Hong Leong', 'bank'], ['AmBank', 'bank'],
  ['Bank Islam', 'bank'], ['BSN', 'bank'], ['UOB', 'bank'], ['OCBC', 'bank'], ['HSBC', 'bank'], ['Alliance Bank', 'bank'], ['Affin Bank', 'bank'],
  ['Bank Rakyat', 'bank'], ['GXBank', 'bank'], ['ASB', 'savings'], ['Tabung Haji', 'savings'], ['Touch ’n Go eWallet', 'ewallet'],
  ['GrabPay', 'ewallet'], ['ShopeePay', 'ewallet'], ['Boost', 'ewallet'], ['Cash', 'cash']];
const EMOJIS = ['🍜', '🍔', '☕', '🧋', '🍱', '🛒', '🥬', '🚗', '⛽', '🚌', '🚕', '🅿️', '🏠', '💡', '💧', '📱', '🌐', '🛍️', '👗', '💄', '💊', '🏥', '🦷', '🎬',
  '🎮', '🎵', '📚', '🎓', '🛡️', '👨‍👩‍👧', '👶', '🐶', '🎁', '✈️', '🏨', '💳', '🏦', '💰', '💼', '🎉', '💻', '🧧', '↩️', '📦', '🔧', '🧾', '🙏', '💇'];
const BILL_IDEAS = ['Rent', 'Electricity (TNB)', 'Water', 'Phone bill', 'Internet', 'Car loan', 'PTPTN', 'Credit card', 'Insurance', 'Netflix', 'Spotify'];
const REMIND_BEFORE = [[0, 'On the day'], [1, '1 day before'], [2, '2 days before'], [3, '3 days before'], [7, '1 week before']];

const shake = (el) => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
const sheetState = () => (topSheet() || {})._st;

function sheetHead(title, opts) {
  opts = opts || {};
  return `<div class="sheet-head"><button class="icon-btn plain" data-a="close-sheet" aria-label="Close">${icon('close')}</button>
    ${opts.middle || `<h2>${title}</h2>`}${opts.right || '<span style="width:44px"></span>'}</div>`;
}

// Selects one chip in its group without redrawing the sheet.
function pick(el, attr) {
  $$(`[data-a="${el.dataset.a}"]`, el.closest('.sheet')).forEach((b) => b.classList.toggle('on', b === el));
  return el.dataset[attr || 'v'];
}

function accountChips(action, selected, exclude) {
  const bal = balances();
  return `<div class="chips scroll">${accounts().filter((a) => a.id !== exclude).map((a) => `<button class="chip ${a.id === selected ? 'on' : ''}" data-a="${action}" data-v="${a.id}">
    ${accIcon(a)} ${esc(a.name)} <span class="num">${money(bal[a.id])}</span></button>`).join('')}</div>`;
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
    : { type: 'expense', expr: '', accountId: preset.acc && acc(preset.acc) ? preset.acc : defaultAccount(), toAccountId: '', categoryId: '', date: today(), note: '' };
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
      <span class="e">${esc(c.icon)}</span><span>${esc(c.name)}</span></button>`).join('')}</div></div>
      <div class="field"><span>${st.type === 'income' ? 'Into' : 'From'} account</span>${accountChips('tx-acc', st.accountId)}</div>`;
  }
  const t = today();
  const y = Shared.addDays(t, -1);
  body += `<div class="field"><span>Date</span><div class="chips">
      <button class="chip ${st.date === t ? 'on' : ''}" data-a="tx-date" data-v="${t}">Today</button>
      <button class="chip ${st.date === y ? 'on' : ''}" data-a="tx-date" data-v="${y}">Yesterday</button>
      <input type="date" class="chip ${st.date !== t && st.date !== y ? 'on' : ''}" value="${st.date}" max="${Shared.addDays(t, 366)}" data-change="tx-date-pick" aria-label="Pick a date">
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
  const sh = openSheet(sheetHead('Balance correction') + `<div class="sheet-body" style="text-align:center">
    <div class="amount-box" style="text-align:center"><div class="amt num">${money(t.amount, { plus: true })}</div></div>
    <p class="muted">${esc((acc(t.accountId) || {}).name || '')} · ${fmtDate(t.date, true)}</p>
    <p class="muted small">Added by “Fix balance” so the app matches the bank.</p></div>
    <div class="sheet-foot"><button class="btn danger block" data-a="adjust-delete">Delete correction</button></div>`);
  sh._st = t;
}
actions['adjust-delete'] = () => { remove('transactions', sheetState().id); closeSheet(); toast('Deleted'); };

actions.add = (el) => openTxEditor(null, { acc: el.dataset.acc });
actions['edit-tx'] = (el) => openTxEditor(el.dataset.id);

// ============================== accounts ==============================
function openAccountEditor(id) {
  const a = id ? S.accounts[id] : null;
  const used = accounts(true).map((x) => x.color);
  const st = a ? Object.assign({}, a) : { id: uid(), name: '', type: 'bank', opening: 0, color: ACC_COLORS.find((c) => used.indexOf(c) < 0) || ACC_COLORS[0],
    order: accounts(true).length, archived: false };
  const sh = openSheet(sheetHead(a ? 'Edit account' : 'New account') + '<div class="sheet-body"></div>' +
    `<div class="sheet-foot"><button class="btn primary block" data-a="acc-save">Save</button></div>`, { cls: 'full' });
  sh._st = st;
  sh._isNew = !a;
  drawAccount(sh);
}

function drawAccount(sh) {
  const st = sh._st;
  const owed = st.type === 'card';
  let body = '';
  if (sh._isNew) {
    body += `<div class="field"><span>Quick pick</span><div class="chips">${BANKS.map(([n, t]) => `<button class="chip ${st.name === n ? 'on' : ''}" data-a="acc-pick" data-v="${esc(n)}" data-t="${t}">${esc(n)}</button>`).join('')}</div></div>`;
  }
  body += `<label class="field"><span>Name</span><input class="input" id="acc-name" maxlength="40" placeholder="e.g. Maybank savings" value="${esc(st.name)}" data-input="acc-name"></label>
    <div class="field"><span>Type</span><div class="chips">${ACCOUNT_TYPES.map(([v, e, l]) => `<button class="chip ${st.type === v ? 'on' : ''}" data-a="acc-type" data-v="${v}">${e} ${l}</button>`).join('')}</div></div>
    <div class="field"><span>${owed ? 'Amount owed now' : sh._isNew ? 'Balance right now' : 'Starting balance'}</span>
      <button class="amount-btn num" data-a="acc-opening">${money(owed ? -st.opening : st.opening)}<span class="hint">🧮 Change</span></button>
      ${!sh._isNew ? '<span class="tiny muted" style="text-transform:none;letter-spacing:0;font-weight:500">The balance before your first record here. To match the bank today, use “Fix balance” on the account’s page instead.</span>' : ''}</div>
    <div class="field"><span>Colour</span><div class="swatches">${ACC_COLORS.map((c) => `<button class="${st.color === c ? 'on' : ''}" style="background:${c}" data-a="acc-color" data-v="${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>`;
  if (!sh._isNew) {
    body += `<div class="item card" style="padding:12px 16px"><span class="grow"><div class="title">Hide this account</div><div class="meta">Keeps its history; hides it when adding records</div></span>
      <label class="switch"><input type="checkbox" ${st.archived ? 'checked' : ''} data-change="acc-archive" aria-label="Hide"><i></i></label></div>
      <button class="btn danger block" data-a="acc-delete">Delete account</button>`;
  }
  $('.sheet-body', sh).innerHTML = body;
}

actions['acc-pick'] = (el) => {
  const st = sheetState();
  st.name = pick(el);
  st.type = el.dataset.t;
  drawAccount(topSheet());
};
actions['acc-name'] = (el) => { sheetState().name = el.value; };
actions['acc-type'] = (el) => {
  const st = sheetState();
  const was = st.type === 'card';
  st.type = pick(el);
  if (was !== (st.type === 'card')) st.opening = -st.opening;
  drawAccount(topSheet());
};
actions['acc-color'] = (el) => { sheetState().color = pick(el); };
actions['acc-archive'] = (el) => { sheetState().archived = el.checked; };
actions['acc-opening'] = async () => {
  const sh = topSheet();
  const st = sh._st;
  const owed = st.type === 'card';
  const v = await askAmount(owed ? 'Amount owed' : 'Balance', Math.abs(st.opening), { allowZero: true });
  if (v === null) return;
  st.opening = owed ? -v : v;
  drawAccount(sh);
};
actions['acc-save'] = () => {
  const sh = topSheet();
  const st = sh._st;
  st.name = (st.name || '').trim();
  if (!st.name) { shake($('#acc-name', sh)); return toast('Give the account a name'); }
  if (accounts(true).some((a) => a.id !== st.id && a.name.toLowerCase() === st.name.toLowerCase())) return toast('You already have an account with that name');
  put('accounts', st);
  closeSheet();
  toast(sh._isNew ? `Added ${st.name} ✓` : 'Saved ✓');
};
actions['acc-delete'] = async () => {
  const st = sheetState();
  if (live('transactions').some((t) => t.accountId === st.id || t.toAccountId === st.id)) {
    return confirmSheet('This account has records', 'To keep your history, hide it instead (switch above). Delete its records first if you really want to delete it.', 'OK');
  }
  if (await confirmSheet(`Delete ${st.name}?`, '', 'Delete', true)) {
    remove('accounts', st.id);
    closeSheet();
    if (view.route === 'account') go('reports');
  }
};
actions['acc-new'] = () => openAccountEditor();
actions['acc-edit'] = (el) => openAccountEditor(el.dataset.id);
actions['acc-move'] = (el) => {
  const list = accounts(true).slice();
  const i = list.findIndex((a) => a.id === el.dataset.id);
  if (i < 1) return;
  list.splice(i - 1, 0, list.splice(i, 1)[0]);
  list.forEach((a, j) => { if ((a.order || 0) !== j) put('accounts', Object.assign({}, a, { order: j })); });
};

actions['acc-adjust'] = async (el) => {
  const a = acc(el.dataset.id);
  const cur = balances()[a.id];
  const owed = a.type === 'card';
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
  let body = `<div class="row"><span class="bubble" style="width:56px;height:56px;font-size:30px">${esc(st.icon)}</span>
      <label class="field grow"><span>Name</span><input class="input" id="cat-name" maxlength="30" value="${esc(st.name)}" data-input="cat-name" placeholder="e.g. Coffee"></label></div>
    <div class="field"><span>Icon</span><div class="emoji-grid">${EMOJIS.map((e) => `<button class="${st.icon === e ? 'on' : ''}" data-a="cat-icon" data-v="${e}">${e}</button>`).join('')}</div></div>`;
  if (st.kind === 'expense') {
    body += `<div class="field"><span>Monthly budget</span><button class="amount-btn num" data-a="cat-budget">${st.budget > 0 ? money(st.budget) : 'No budget'}<span class="hint">🧮 Change</span></button></div>`;
  }
  if (!sh._isNew) {
    body += `<div class="item card" style="padding:12px 16px"><span class="grow"><div class="title">Hide this category</div><div class="meta">Keeps old records; hides it when adding new ones</div></span>
      <label class="switch"><input type="checkbox" ${st.archived ? 'checked' : ''} data-change="cat-archive" aria-label="Hide"><i></i></label></div>`;
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
  const st = r ? Object.assign({}, r) : { id: uid(), title: '', amount: 0, due: Shared.addDays(today(), 7), repeat: 'month', before: 3, time: '09:00',
    active: true, day: 0, accountId: '', categoryId: '', note: '', lastPaid: '' };
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
  if (sh._isNew) body += `<div class="chips">${BILL_IDEAS.map((t) => `<button class="chip" data-a="bill-idea" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  body += `<div class="field"><span>Amount (optional)</span><button class="amount-btn num" data-a="bill-amount">${st.amount ? money(st.amount) : 'Not set'}<span class="hint">🧮 Change</span></button></div>
    <label class="field"><span>${st.active ? 'Next due date' : 'Due date'}</span><input class="input" type="date" value="${st.due}" data-change="bill-due"></label>
    <div class="field"><span>Repeats</span><div class="chips">${Object.keys(Shared.REPEATS).map((k) => `<button class="chip ${st.repeat === k ? 'on' : ''}" data-a="bill-repeat" data-v="${k}">${Shared.REPEATS[k].label}</button>`).join('')}</div></div>
    <div class="field"><span>Remind me</span><div class="chips">${REMIND_BEFORE.map(([d, l]) => `<button class="chip ${Number(st.before) === d ? 'on' : ''}" data-a="bill-before" data-v="${d}">${l}</button>`).join('')}</div></div>
    <label class="field"><span>At what time</span><input class="input" type="time" value="${esc(st.time)}" data-change="bill-time"></label>
    <div class="field"><span>Usually paid from (optional)</span>${accounts().length ? accountChips('bill-acc', st.accountId) : '<span class="muted small">Add an account first.</span>'}</div>
    <label class="field"><span>Category when paid</span><select class="input" data-change="bill-cat"><option value="">Choose…</option>
      ${cats.map((c) => `<option value="${c.id}" ${c.id === st.categoryId ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></label>`;
  if (!sh._isNew && !st.active) body += `<button class="btn block" data-a="bill-reactivate">Start reminding again</button>`;
  $('.sheet-body', sh).innerHTML = body;
}

actions['bill-title'] = (el) => { sheetState().title = el.value; };
actions['bill-idea'] = (el) => {
  const st = sheetState();
  st.title = el.dataset.v;
  if (!st.categoryId) {
    const guess = { Rent: 'Rent', 'Electricity (TNB)': 'Bills', Water: 'Bills', 'Phone bill': 'Phone', Internet: 'Phone', 'Car loan': 'Loan', PTPTN: 'Loan',
      'Credit card': 'Loan', Insurance: 'Insurance', Netflix: 'Entertainment', Spotify: 'Entertainment' }[st.title];
    const c = guess && categories('expense').find((x) => x.name.indexOf(guess) === 0);
    if (c) st.categoryId = c.id;
  }
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
actions['bill-reactivate'] = () => { sheetState().active = true; drawBill(topSheet()); toast('Check the due date, then Save'); };
actions['bill-save'] = () => {
  const sh = topSheet();
  const st = sh._st;
  st.title = (st.title || '').trim();
  if (!st.title) { shake($('#bill-title', sh)); return toast('Give the bill a name'); }
  if (!Shared.isDate(st.due)) return toast('Pick a due date');
  const old = S.reminders[st.id];
  if (!old || old.due !== st.due || !st.day) st.day = +st.due.slice(8);
  put('reminders', st);
  closeSheet();
  const n = Shared.daysBetween(today(), st.due);
  toast(`Saved ✓ Due ${Shared.relDays(n)}`);
  if (sh._isNew && pushState() === 'default') setTimeout(() => toast('Tip: turn on notifications at the top of Bills', 3500), 2300);
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
      <div style="text-align:center"><h2>${esc(r.title)}</h2><p class="muted small">Due ${fmtDate(r.due, true)}${next ? ' · then next on ' + fmtDate(next, true) : ''}</p></div>
      <div class="field"><span>Amount paid</span><button class="amount-btn num" data-a="pay-amount">${money(st.amount)}<span class="hint">🧮 Change</span></button></div>
      ${accounts().length ? `<div class="item card" style="padding:12px 16px"><span class="grow"><div class="title">Record as spending</div>
        <div class="meta">${c ? esc(c.icon) + ' ' + esc(c.name) : ''}</div></span><label class="switch"><input type="checkbox" checked data-change="pay-record" aria-label="Record as spending"><i></i></label></div>
      <div class="field" id="pay-acc"><span>Paid from</span>${accountChips('pay-acc', st.accountId)}</div>` : ''}
    </div><div class="sheet-foot"><button class="btn primary block" data-a="pay-save">${icon('check')} Mark as paid</button></div>`);
  sh._st = st;
};
actions['pay-amount'] = async (el) => {
  const st = sheetState();
  const v = await askAmount('Amount paid', st.amount, { allowZero: true });
  if (v === null) return;
  st.amount = v;
  el.firstChild.textContent = money(v);
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
