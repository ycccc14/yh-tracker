// My Tracker widget for iPhone. Runs in the free Scriptable app.
// Copy it from My Tracker ▸ Settings ▸ Home Screen widget: that fills in your code below.
// My Tracker paints the widget, so designs and pictures change there and this script never needs copying again.
// It fetches the sealed picture and opens it here on the phone, and seals records added here so only
// My Tracker can open them (Scriptable has no built-in encryption, so AES-GCM is written out).

const CODE = '__WIDGET_CODE__';
const APP_URL = 'https://ycccc14.github.io/yh-tracker/?w=1'; // Safari: iPhones can't open the Home Screen app from a widget
const STORE = 'my-tracker-widget.json';
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

// GHASH with a 4-bit table (16 multiples of H, one shift per nibble), so a whole picture opens quickly.
function ghashTable(h) {
  const table = [];
  for (let n = 0; n < 16; n++) {
    const z = new Array(16).fill(0);
    const v = h.slice();
    for (let bit = 0; bit < 4; bit++) {
      if (n & (8 >> bit)) for (let j = 0; j < 16; j++) z[j] ^= v[j];
      const low = v[15] & 1;
      for (let j = 15; j > 0; j--) v[j] = (v[j] >> 1) | ((v[j - 1] & 1) << 7);
      v[0] >>= 1;
      if (low) v[0] ^= 225;
    }
    table.push(z);
  }
  return table;
}
const GCM_REDUCE = [0x0000, 0x1c20, 0x3840, 0x2460, 0x7080, 0x6ca0, 0x48c0, 0x54e0, 0xe100, 0xfd20, 0xd940, 0xc560, 0x9180, 0x8da0, 0xa9c0, 0xb5e0];
function ghashMul(x, table) {
  const z = new Array(16).fill(0);
  for (let i = 31; i >= 0; i--) {
    const nib = i & 1 ? x[i >> 1] & 15 : x[i >> 1] >> 4;
    if (i !== 31) { // z = z * x^4
      const low = z[15] & 15;
      for (let j = 15; j > 0; j--) z[j] = (z[j] >> 4) | ((z[j - 1] & 15) << 4);
      z[0] >>= 4;
      z[0] ^= GCM_REDUCE[low] >> 8;
      z[1] ^= GCM_REDUCE[low] & 255;
    }
    const t = table[nib];
    for (let j = 0; j < 16; j++) z[j] ^= t[j];
  }
  return z;
}

const counter = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

// The tag over a ciphertext, and the same keystream both ways.
function gcmTag(aes, iv, ct) {
  const table = ghashTable(aes(new Array(16).fill(0)));
  let y = new Array(16).fill(0);
  const absorb = (b) => { for (let i = 0; i < 16; i++) y[i] ^= b[i] || 0; y = ghashMul(y, table); };
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

// sealed = iv (12 bytes) + ciphertext + tag (16 bytes), as the app's Crypt makes it.
function openBytes(keyB64, sealedB64) {
  const aes = makeAes(fromB64(keyB64));
  const all = fromB64(sealedB64);
  const iv = all.slice(0, 12);
  const ct = all.slice(12, all.length - 16);
  const tag = all.slice(all.length - 16);
  if (gcmTag(aes, iv, ct).some((v, i) => v !== tag[i])) throw new Error('sealed');
  return gcmStream(aes, iv, ct);
}
const openSealed = (keyB64, sealedB64) => JSON.parse(decodeURIComponent(openBytes(keyB64, sealedB64).map((b) => '%' + (b < 16 ? '0' : '') + b.toString(16)).join('')));

function hexBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
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

// ============================== fetching ==============================
const parts = CODE.split('|');
const connected = parts[0] === 'MTW1' && parts.length === 4;
const fm = FileManager.local();
const inDocs = (name) => fm.joinPath(fm.documentsDirectory(), name);
const storeFile = inDocs(STORE);
const emptyStore = () => ({ summary: null, at: {}, queue: [] });

function readStore() {
  try { return fm.fileExists(storeFile) ? Object.assign(emptyStore(), JSON.parse(fm.readString(storeFile))) : emptyStore(); } catch (e) { return emptyStore(); }
}
const writeStore = (store) => fm.writeString(storeFile, JSON.stringify(store));
const imageFile = (size) => inDocs(`my-tracker-${size}.img`);

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

function forget(store) {
  ['s', 'm', 'l'].forEach((size) => { if (fm.fileExists(imageFile(size))) fm.remove(imageFile(size)); });
  if (fm.fileExists(storeFile)) fm.remove(storeFile);
  store.summary = null;
}

async function load(size) {
  if (!connected) return { message: 'Copy the script again from My Tracker.' };
  const store = readStore();
  await sendQueue(store);
  let res = null;
  try { res = await call('widgetGet', { size, have: store.at[size] || '' }); } catch (e) { /* offline: the last picture below */ }
  if (res && res.code === 'WIDGET_OFF') {
    forget(store);
    return { message: 'The widget is off in My Tracker.' };
  }
  if (res && res.ok) {
    try {
      store.summary = openSealed(parts[3], res.result.data);
      if (res.result.img) {
        const bytes = openBytes(parts[3], res.result.img);
        fm.write(imageFile(size), Data.fromBase64String(toB64(bytes).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((3 - bytes.length % 3) % 3)));
        store.at[size] = res.result.imgAt;
      }
    } catch (e) {
      return { message: 'Copy the script again from My Tracker.' };
    }
  }
  writeStore(store);
  if (fm.fileExists(imageFile(size))) return { image: Image.fromFile(imageFile(size)), summary: store.summary };
  return { message: res && res.ok ? 'Open My Tracker once to draw this widget.' : 'Waiting for the internet.' };
}

function money(x, cur) {
  return cur + Math.abs(Number(x) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================== the iPhone's add form ==============================
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
  store.queue.push(entry);
  await sendQueue(store);
  writeStore(store);
  await say('Saved ✓', money(amount, s.cur) + (store.queue.length ? '\nIt will upload when you’re back online.' : '\nIt will show in My Tracker when you next open it.'));
}

// ============================== the widget ==============================
const tapUrl = (summary, add) => {
  if (summary && summary.tap === 'form') return URLScheme.forRunningScript() + '?add=' + (add || 'menu');
  return APP_URL + (add ? '#add/' + add : '#home');
};

function draw(state, size) {
  const w = new ListWidget();
  w.setPadding(0, 0, 0, 0);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  w.url = tapUrl(state.summary);
  if (!state.image) {
    w.backgroundColor = new Color('#F7F4EE');
    w.setPadding(14, 14, 14, 14);
    const note = w.addText(state.message);
    note.font = Font.mediumSystemFont(14);
    note.textColor = new Color('#1E2A3A');
    return w;
  }
  w.backgroundImage = state.image;
  const quick = state.summary && state.summary.quick && state.summary.quick[size];
  if (quick && size !== 's') { // the painted buttons sit in the lower 55%, in three equal columns
    w.addSpacer();
    const row = w.addStack();
    row.size = new Size(0, size === 'l' ? 180 : 86);
    ['expense', 'income', 'transfer'].forEach((type) => {
      const b = row.addStack();
      b.size = new Size(0, 0);
      b.url = tapUrl(state.summary, type);
      b.addSpacer();
    });
  } else {
    w.addSpacer();
  }
  return w;
}

const want = (args.queryParameters || {}).add;
if (want && !config.runsInWidget) {
  await addRecord(want);
} else {
  const size = { small: 's', medium: 'm', large: 'l' }[config.widgetFamily] || 'm';
  const widget = draw(await load(size), size);
  if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
}
Script.complete();
