// My Tracker widget for iPhone. Runs in the free Scriptable app.
// Copy it from My Tracker ▸ Settings ▸ Home Screen widget: that fills in your code below.
// The design is chosen in My Tracker, so this script never needs copying again.
// It fetches one sealed summary and opens it here on the phone, and seals records added here so
// only My Tracker can open them (Scriptable has no built-in encryption, so AES-GCM is written out).

const CODE = '__WIDGET_CODE__';
const STORE = 'my-tracker-widget.json';
const PAPER = '#F7F4EE';
const DARK = '#1E2A3A';
const ART = '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';
const TYPES = { expense: 'Expense', income: 'Income', transfer: 'Transfer' };

// ============================== AES-256-GCM ==============================
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function fromB64(text) {
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) {
    value = value * 64 + B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push(Math.floor(value / 2 ** bits) & 255);
      value %= 2 ** bits;
    }
  }
  return out;
}

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    s += B64[n >> 18] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += B64[n & 63];
  }
  return s;
}

function makeAes(key) {
  const sbox = [];
  let p = 1;
  let q = 1;
  do { // the standard S-box, worked out instead of listed
    p = (p ^ (p << 1) ^ (p & 128 ? 27 : 0)) & 255;
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 255;
    if (q & 128) q ^= 9;
    const rot = (n) => ((q << n) | (q >> (8 - n))) & 255;
    sbox[p] = q ^ rot(1) ^ rot(2) ^ rot(3) ^ rot(4) ^ 99;
  } while (p !== 1);
  sbox[0] = 99;
  const xt = (b) => ((b << 1) ^ (b & 128 ? 27 : 0)) & 255;
  const words = [];
  for (let i = 0; i < 8; i++) words.push(key.slice(i * 4, i * 4 + 4));
  let rcon = 1;
  for (let i = 8; i < 60; i++) {
    let t = words[i - 1].slice();
    if (i % 8 === 0) {
      t = [sbox[t[1]] ^ rcon, sbox[t[2]], sbox[t[3]], sbox[t[0]]];
      rcon = xt(rcon);
    } else if (i % 8 === 4) {
      t = t.map((b) => sbox[b]);
    }
    words.push(t.map((b, j) => b ^ words[i - 8][j]));
  }
  return (block) => {
    let s = block.slice();
    const addKey = (r) => { for (let i = 0; i < 16; i++) s[i] ^= words[r * 4 + (i >> 2)][i & 3]; };
    addKey(0);
    for (let r = 1; r <= 14; r++) {
      const m = [];
      for (let c = 0; c < 4; c++) for (let w = 0; w < 4; w++) m[c * 4 + w] = sbox[s[((c + w) % 4) * 4 + w]]; // SubBytes + ShiftRows
      if (r < 14) {
        for (let c = 0; c < 4; c++) { // MixColumns
          const [a, b, d, e] = m.slice(c * 4, c * 4 + 4);
          m[c * 4] = xt(a) ^ xt(b) ^ b ^ d ^ e;
          m[c * 4 + 1] = a ^ xt(b) ^ xt(d) ^ d ^ e;
          m[c * 4 + 2] = a ^ b ^ xt(d) ^ xt(e) ^ e;
          m[c * 4 + 3] = xt(a) ^ a ^ b ^ d ^ xt(e);
        }
      }
      s = m;
      addKey(r);
    }
    return s;
  };
}

function ghashMul(x, h) {
  const z = new Array(16).fill(0);
  const v = h.slice();
  for (let i = 0; i < 128; i++) {
    if (x[i >> 3] & (128 >> (i & 7))) for (let j = 0; j < 16; j++) z[j] ^= v[j];
    const low = v[15] & 1;
    for (let j = 15; j > 0; j--) v[j] = (v[j] >> 1) | ((v[j - 1] & 1) << 7);
    v[0] >>= 1;
    if (low) v[0] ^= 225;
  }
  return z;
}

const counter = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

// The tag over a ciphertext, and the same keystream both ways.
function gcmTag(aes, iv, ct) {
  const h = aes(new Array(16).fill(0));
  let y = new Array(16).fill(0);
  const absorb = (b) => { y = ghashMul(y.map((v, i) => v ^ (b[i] || 0)), h); };
  for (let i = 0; i < ct.length; i += 16) absorb(ct.slice(i, i + 16));
  absorb(new Array(12).fill(0).concat(counter(ct.length * 8)));
  const mask = aes(iv.concat(counter(1)));
  return y.map((v, i) => v ^ mask[i]);
}
function gcmStream(aes, iv, input) {
  const out = [];
  for (let i = 0; i < input.length; i += 16) {
    const stream = aes(iv.concat(counter(i / 16 + 2)));
    for (let j = 0; j < 16 && i + j < input.length; j++) out.push(input[i + j] ^ stream[j]);
  }
  return out;
}

// sealed = iv (12 bytes) + ciphertext + tag (16 bytes), as the app's Crypt.sealJson makes it.
function openSealed(keyB64, sealedB64) {
  const aes = makeAes(fromB64(keyB64));
  const all = fromB64(sealedB64);
  const iv = all.slice(0, 12);
  const ct = all.slice(12, all.length - 16);
  const tag = all.slice(all.length - 16);
  if (gcmTag(aes, iv, ct).some((v, i) => v !== tag[i])) throw new Error('sealed');
  return JSON.parse(decodeURIComponent(gcmStream(aes, iv, ct).map((b) => '%' + (b < 16 ? '0' : '') + b.toString(16)).join('')));
}

function seal(keyB64, obj) {
  const aes = makeAes(fromB64(keyB64));
  const iv = hexBytes(UUID.string()).slice(0, 6).concat(hexBytes(UUID.string()).slice(0, 6)); // random: the first 6 bytes of a UUID have no fixed bits
  const plain = [];
  const text = encodeURIComponent(JSON.stringify(obj));
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '%') { plain.push(parseInt(text.slice(i + 1, i + 3), 16)); i += 2; } else plain.push(text.charCodeAt(i));
  }
  const ct = gcmStream(aes, iv, plain);
  return toB64(iv.concat(ct, gcmTag(aes, iv, ct)));
}
function hexBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

// ============================== the numbers ==============================
const parts = CODE.split('|');
const connected = parts[0] === 'MTW1' && parts.length === 4;
const fm = FileManager.local();
const storeFile = fm.joinPath(fm.documentsDirectory(), STORE);
const emptyStore = () => ({ summary: null, pending: [], queue: [] });

function readStore() {
  try { return fm.fileExists(storeFile) ? Object.assign(emptyStore(), JSON.parse(fm.readString(storeFile))) : emptyStore(); } catch (e) { return emptyStore(); }
}
const writeStore = (store) => fm.writeString(storeFile, JSON.stringify(store));

async function call(fn, arg) {
  const req = new Request(parts[1]);
  req.method = 'POST';
  req.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
  req.body = JSON.stringify({ fn, args: [Object.assign({ t: parts[2] }, arg)] });
  return req.loadJSON();
}

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Sends records that are waiting. Stops at the first one the internet can't take.
async function sendQueue(store) {
  while (store.queue.length) {
    const e = store.queue[0];
    let res = null;
    try { res = await call('widgetAdd', { id: e.id, data: seal(parts[3], e) }); } catch (err) { return; }
    if (!res.ok && res.code !== 'WIDGET_OFF') return;
    store.queue.shift();
  }
}

// What to show: the phone's summary plus records added here that My Tracker hasn't taken yet.
function withPending(store) {
  if (!store.summary) return null;
  const s = Object.assign({}, store.summary);
  const day = localDay();
  if (s.day !== day) s.today = 0;
  for (const e of store.pending) {
    if (e.type === 'transfer') continue;
    const sign = e.type === 'income' ? 1 : -1;
    s.balance += sign * e.amount;
    if (e.date.slice(0, 7) === s.ym) {
      s[e.type] += e.amount;
      if (e.type === 'expense') { s.spent += e.amount; if (s.budget) s.left -= e.amount; }
    }
    if (e.type === 'expense' && e.date === day) s.today += e.amount;
  }
  return s;
}

async function load() {
  if (!connected) return { message: 'Copy the script again from My Tracker.' };
  const store = readStore();
  await sendQueue(store);
  let res = null;
  try { res = await call('widgetGet', {}); } catch (e) { /* offline: the last numbers below */ }
  if (res && res.ok) {
    try {
      store.summary = openSealed(parts[3], res.result.data);
      const done = store.summary.done || [];
      store.pending = store.pending.filter((e) => !done.includes(e.id));
      writeStore(store);
      return { summary: withPending(store) };
    } catch (e) {
      return { message: 'Copy the script again from My Tracker.' };
    }
  }
  if (res && res.code === 'WIDGET_OFF') {
    if (fm.fileExists(storeFile)) fm.remove(storeFile);
    return { message: 'The widget is off in My Tracker.' };
  }
  writeStore(store);
  if (store.summary) return { summary: withPending(store) };
  return { message: 'Waiting for the internet.' };
}

function money(x, cur) {
  const n = Math.abs(Number(x) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (x < 0 ? '−' : '') + cur + n;
}

// ============================== adding a record ==============================
async function choose(title, names) {
  const a = new Alert();
  a.title = title;
  names.forEach((n) => a.addAction(n));
  a.addCancelAction('Cancel');
  return a.presentSheet();
}
async function say(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message || '';
  a.addAction('OK');
  await a.presentAlert();
}

async function addRecord(want) {
  const store = readStore();
  const s = store.summary;
  if (!connected || !s || !(s.accounts || []).length) {
    await say('Not ready yet', 'Open My Tracker and add an account first. Then try again.');
    return;
  }
  let type = want;
  if (!TYPES[type]) {
    const i = await choose('Add', Object.values(TYPES));
    if (i < 0) return;
    type = Object.keys(TYPES)[i];
  }
  const form = new Alert();
  form.title = 'New ' + TYPES[type].toLowerCase();
  form.addTextField('Amount in ' + s.cur, '').setDecimalPadKeyboard();
  form.addTextField('Note (optional)', '');
  form.addAction('Next');
  form.addCancelAction('Cancel');
  if ((await form.presentAlert()) < 0) return;
  const amount = Math.round(Number(form.textFieldValue(0).replace(',', '.')) * 100) / 100;
  if (!(amount > 0 && amount < 1e9)) { await say('Type an amount', 'For example 12.50.'); return; }

  const pickFrom = async (title, list) => {
    if (list.length === 1) return list[0];
    const i = await choose(title, list.map((x) => (x.e ? x.e + ' ' : '') + x.n));
    return i < 0 ? null : list[i];
  };
  const account = await pickFrom(type === 'transfer' ? 'From which account?' : 'Which account?', s.accounts);
  if (!account) return;
  const entry = { id: hexBytes(UUID.string()).map((b) => (b < 16 ? '0' : '') + b.toString(16)).join(''), type, amount, accountId: account.i, toAccountId: '', categoryId: '',
    note: form.textFieldValue(1).trim().slice(0, 200), date: localDay() };
  if (type === 'transfer') {
    const others = s.accounts.filter((x) => x.i !== account.i);
    if (!others.length) { await say('One account only', 'Add another account in My Tracker to make a transfer.'); return; }
    const to = await pickFrom('To which account?', others);
    if (!to) return;
    entry.toAccountId = to.i;
  } else {
    const list = (type === 'income' ? s.in : s.ex) || [];
    if (list.length) {
      const c = await pickFrom('Which category?', list);
      if (!c) return;
      entry.categoryId = c.i;
    }
  }
  store.pending.push(entry);
  store.queue.push(entry);
  await sendQueue(store);
  writeStore(store);
  await say('Saved ✓', money(amount, s.cur) + (store.queue.length ? '\nIt will upload when you’re back online.' : '\nIt will show in My Tracker when you next open it.'));
}

// ============================== the designs ==============================
const runUrl = (add) => URLScheme.forRunningScript() + '?add=' + add;

function text(stack, value, size, color, opts) {
  const t = stack.addText(value);
  t.font = opts && opts.plain ? Font.mediumSystemFont(size) : Font.boldSystemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.5;
  if (opts && opts.dim) t.textOpacity = 0.75;
  return t;
}

function drawClassic(w, s, color, ink) {
  const dark = new Color(DARK);
  const top = w.addStack();
  top.centerAlignContent();
  const art = top.addImage(Image.fromData(Data.fromBase64String(ART)));
  art.imageSize = new Size(104, 58);
  top.addSpacer();
  const sign = top.addStack();
  sign.setPadding(4, 14, 4, 14);
  sign.cornerRadius = 8;
  sign.backgroundColor = Color.white();
  text(sign, s.month, 16, dark);
  const panel = w.addStack();
  panel.backgroundColor = color;
  panel.cornerRadius = 14;
  panel.setPadding(10, 10, 10, 10);
  panel.centerAlignContent();
  [['Expenses', s.expense], ['Income', s.income], ['Balance', s.balance]].forEach(([name, value], i) => {
    if (i) panel.addSpacer();
    const col = panel.addStack();
    col.layoutVertically();
    text(col, name, 12, ink, { plain: true, dim: true });
    col.addSpacer(2);
    text(col, money(value, s.cur), 15, ink);
  });
}

function drawBalance(w, s, color, ink) {
  w.backgroundColor = color;
  text(w, 'Balance', 14, ink, { plain: true, dim: true });
  w.addSpacer(4);
  text(w, money(s.balance, s.cur), 32, ink);
  w.addSpacer(6);
  text(w, `${s.month}: spent ${money(s.expense, s.cur)}`, 13, ink, { plain: true, dim: true });
}

function drawBudget(w, s, color) {
  const dark = new Color(DARK);
  const head = w.addStack();
  text(head, 'Budget', 14, dark, { plain: true, dim: true });
  head.addSpacer();
  text(head, s.month, 14, dark);
  w.addSpacer(6);
  if (!s.budget) {
    text(w, 'Set a budget in My Tracker', 16, dark);
    return;
  }
  text(w, money(s.left, s.cur) + ' left', 26, dark);
  w.addSpacer(8);
  const full = 280;
  const track = w.addStack();
  track.size = new Size(full, 10);
  track.cornerRadius = 5;
  track.backgroundColor = new Color('#000000', 0.1);
  const bar = track.addStack();
  bar.size = new Size(Math.max(1, Math.round(full * Math.min(1, s.spent / s.budget))), 10);
  bar.cornerRadius = 5;
  bar.backgroundColor = color;
  track.addSpacer();
  w.addSpacer(6);
  text(w, `${money(s.spent, s.cur)} of ${money(s.budget, s.cur)}`, 13, dark, { plain: true, dim: true });
}

function drawQuick(w, s, color, ink) {
  const dark = new Color(DARK);
  const head = w.addStack();
  text(head, 'Today ' + money(s.today, s.cur), 14, dark, { plain: true });
  head.addSpacer();
  text(head, money(s.balance, s.cur), 14, dark);
  w.addSpacer(10);
  const row = w.addStack();
  [['expense', '＋ Expense'], ['income', '＋ Income'], ['transfer', '⇄ Transfer']].forEach(([type, label], i) => {
    if (i) row.addSpacer(8);
    const b = row.addStack();
    b.backgroundColor = color;
    b.cornerRadius = 14;
    b.setPadding(16, 8, 16, 8);
    b.url = runUrl(type);
    b.addSpacer();
    text(b, label, 13, ink);
    b.addSpacer();
  });
}

// A small widget has one tap and little room: always the balance, with the month's spending.
function drawSmall(w, s, color, ink) {
  w.backgroundColor = color;
  text(w, s.month, 13, ink, { plain: true, dim: true });
  w.addSpacer(4);
  text(w, money(s.balance, s.cur), 22, ink);
  w.addSpacer(4);
  text(w, 'Spent ' + money(s.expense, s.cur), 12, ink, { plain: true, dim: true });
}

function draw(state) {
  const s = state.summary;
  const color = new Color(s ? s.color : '#93C572');
  const ink = new Color(s ? s.ink : '#1B330C');
  const w = new ListWidget();
  w.backgroundColor = new Color(PAPER);
  w.setPadding(12, 14, 12, 14);
  w.url = runUrl('menu'); // iPhones can't open My Tracker from here: links land in Safari, outside the app
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  if (!s) {
    text(w, state.message, 14, new Color(DARK), { plain: true });
    return w;
  }
  if (config.widgetFamily === 'small') drawSmall(w, s, color, ink);
  else if (s.design === 'balance') drawBalance(w, s, color, ink);
  else if (s.design === 'budget') drawBudget(w, s, color);
  else if (s.design === 'quick') drawQuick(w, s, color, ink);
  else drawClassic(w, s, color, ink);
  return w;
}

const want = (args.queryParameters || {}).add;
if (want && !config.runsInWidget) {
  await addRecord(want);
} else {
  const widget = draw(await load());
  if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
}
Script.complete();
