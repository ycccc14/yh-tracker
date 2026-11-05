// My Tracker widget for iPhone. Runs in the free Scriptable app.
// Copy it from My Tracker ▸ Settings ▸ Home Screen widget: that fills in your code below.
// It fetches one sealed summary and opens it here on the phone (Scriptable has no built-in
// decryption, so AES-GCM is written out in full).

const CODE = '__WIDGET_CODE__';
const APP_URL = 'https://ycccc14.github.io/yh-tracker/';
const CACHE = 'my-tracker-widget.json';
const PAPER = '#F7F4EE';
const ART = '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';

function fromB64(text) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) {
    value = value * 64 + abc.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push(Math.floor(value / 2 ** bits) & 255);
      value %= 2 ** bits;
    }
  }
  return out;
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

// sealed = iv (12 bytes) + ciphertext + tag (16 bytes), as the app's Crypt.sealJson makes it.
function openSealed(keyB64, sealedB64) {
  const aes = makeAes(fromB64(keyB64));
  const all = fromB64(sealedB64);
  const iv = all.slice(0, 12);
  const ct = all.slice(12, all.length - 16);
  const tag = all.slice(all.length - 16);
  const h = aes(new Array(16).fill(0));
  let y = new Array(16).fill(0);
  const absorb = (b) => { y = ghashMul(y.map((v, i) => v ^ (b[i] || 0)), h); };
  for (let i = 0; i < ct.length; i += 16) absorb(ct.slice(i, i + 16));
  const bits = ct.length * 8;
  absorb([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255]);
  const mask = aes(iv.concat([0, 0, 0, 1]));
  if (y.some((v, i) => (v ^ mask[i]) !== tag[i])) throw new Error('sealed');
  const plain = [];
  for (let i = 0; i < ct.length; i += 16) {
    const n = i / 16 + 2;
    const stream = aes(iv.concat([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]));
    for (let j = 0; j < 16 && i + j < ct.length; j++) plain.push(ct[i + j] ^ stream[j]);
  }
  return JSON.parse(decodeURIComponent(plain.map((b) => '%' + (b < 16 ? '0' : '') + b.toString(16)).join('')));
}

function money(x, cur) {
  const n = Math.abs(Number(x) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (x < 0 ? '−' : '') + cur + n;
}

async function load() {
  const fm = FileManager.local();
  const file = fm.joinPath(fm.documentsDirectory(), CACHE);
  const parts = CODE.split('|');
  if (parts[0] !== 'MTW1' || parts.length !== 4) return { message: 'Copy the script again from My Tracker.' };
  let res = null;
  try {
    const req = new Request(parts[1]);
    req.method = 'POST';
    req.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    req.body = JSON.stringify({ fn: 'widgetGet', args: [{ t: parts[2] }] });
    res = await req.loadJSON();
  } catch (e) { /* offline: the last numbers below */ }
  if (res && res.ok) {
    try {
      const summary = openSealed(parts[3], res.result.data);
      fm.writeString(file, JSON.stringify(summary));
      return { summary };
    } catch (e) {
      return { message: 'Copy the script again from My Tracker.' };
    }
  }
  if (res && res.code === 'WIDGET_OFF') {
    if (fm.fileExists(file)) fm.remove(file);
    return { message: 'The widget is off in My Tracker.' };
  }
  if (fm.fileExists(file)) return { summary: JSON.parse(fm.readString(file)) };
  return { message: 'Waiting for the internet.' };
}

function draw(state) {
  const s = state.summary;
  const color = new Color(s ? s.color : '#93C572');
  const ink = new Color(s ? s.ink : '#1B330C');
  const w = new ListWidget();
  w.backgroundColor = new Color(PAPER);
  w.setPadding(12, 14, 12, 14);
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

  const top = w.addStack();
  top.centerAlignContent();
  const art = top.addImage(Image.fromData(Data.fromBase64String(ART)));
  art.imageSize = new Size(104, 58);
  top.addSpacer();
  if (s) {
    const sign = top.addStack();
    sign.setPadding(4, 14, 4, 14);
    sign.cornerRadius = 8;
    sign.borderWidth = 2;
    sign.borderColor = color;
    const month = sign.addText(s.month);
    month.font = Font.boldSystemFont(16);
    month.textColor = new Color('#1E2A3A');
  }

  const panel = w.addStack();
  panel.backgroundColor = color;
  panel.cornerRadius = 14;
  panel.setPadding(10, 10, 10, 10);
  panel.centerAlignContent();
  if (!s) {
    const note = panel.addText(state.message);
    note.font = Font.mediumSystemFont(13);
    note.textColor = ink;
    panel.addSpacer();
    return w;
  }
  [['Expenses', s.expense], ['Income', s.income], ['Balance', s.balance]].forEach(([name, value], i) => {
    if (i) panel.addSpacer();
    const col = panel.addStack();
    col.layoutVertically();
    const label = col.addText(name);
    label.font = Font.mediumSystemFont(12);
    label.textColor = ink;
    label.textOpacity = 0.75;
    col.addSpacer(2);
    const amount = col.addText(money(value, s.cur));
    amount.font = Font.boldSystemFont(15);
    amount.textColor = ink;
    amount.lineLimit = 1;
    amount.minimumScaleFactor = 0.5;
  });
  return w;
}

const widget = draw(await load());
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
Script.complete();
