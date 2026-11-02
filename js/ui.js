// Building blocks for the screens: icons, actions, bottom sheets, toasts, the keypad and charts.
'use strict';

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  records: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6',
  stats: 'M4 20V11M10 20V4M16 20v-6M22 20H2',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2zM16.5 14.5h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-6',
  budget: 'M21 12A9 9 0 1 1 12 3v9zM15 3.5a9 9 0 0 1 5.5 5.5H15z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8M10.3 21a1.9 1.9 0 0 0 3.4 0',
  plus: 'M12 5v14M5 12h14',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  close: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  check: 'M20 6 9 17l-5-5',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  calendar: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  sync: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  share: 'M12 3v12M8 7l4-4 4 4M5 11v9h14v-9',
  backspace: 'M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6',
  transfer: 'M7 7h13l-4-4M17 17H4l4 4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  up: 'M18 15l-6-6-6 6',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;

// ============================== actions ==============================
// Elements with data-a="name" run actions[name](element, event) when tapped.
const actions = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el, e); }
});
// data-change="name" on inputs: actions[name](input) on change.
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) actions[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && actions[el.dataset.input]) actions[el.dataset.input](el, e);
});

// ============================== toast ==============================
let toastTimer = 0;
function toast(msg, ms) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
}

// ============================== bottom sheets ==============================
const sheetStack = [];

function openSheet(html, opts) {
  opts = opts || {};
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="backdrop" data-a="close-sheet"></div><div class="sheet ${opts.cls || ''}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  $('#sheets').appendChild(wrap);
  const sheet = wrap.querySelector('.sheet');
  sheetStack.push({ wrap, sheet, opts });
  void wrap.offsetHeight;
  wrap.classList.add('open');
  dragToClose(sheet);
  return sheet;
}

function closeSheet(result) {
  const e = sheetStack.pop();
  if (!e) return;
  if (document.activeElement && e.sheet.contains(document.activeElement)) document.activeElement.blur();
  e.wrap.classList.remove('open');
  setTimeout(() => e.wrap.remove(), 320);
  if (e.opts.onClose) e.opts.onClose(result);
}
const topSheet = () => (sheetStack.length ? sheetStack[sheetStack.length - 1].sheet : null);
const closeAllSheets = () => { while (sheetStack.length) closeSheet(); };
actions['close-sheet'] = () => closeSheet();

// Pull a sheet down by its top bar to close it.
function dragToClose(sheet) {
  let y0 = null;
  let dy = 0;
  const start = (e) => {
    if (e.target.closest('button, input, select, textarea')) return;
    if (!e.target.closest('.grab, .sheet-head')) return;
    y0 = e.touches[0].clientY;
    dy = 0;
    sheet.style.transition = 'none';
  };
  const move = (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 110 && topSheet() === sheet) closeSheet();
  };
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: true });
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}

function confirmSheet(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    let answer = false;
    const sh = openSheet(`<div class="sheet-body center-text" style="padding-top:14px"><h2>${esc(title)}</h2>
      ${text ? `<p class="muted">${esc(text)}</p>` : ''}</div>
      <div class="sheet-foot"><button class="btn block ${danger ? 'danger' : 'primary'}" data-a="confirm-yes">${esc(okLabel || 'OK')}</button>
      <button class="btn block" data-a="close-sheet">Cancel</button></div>`, { onClose: () => resolve(answer) });
    sh._yes = () => { answer = true; closeSheet(); };
  });
}
actions['confirm-yes'] = () => topSheet()._yes();

// ============================== keypad ==============================
function keypadHTML(okLabel) {
  const k = (v, cls, label) => `<button type="button" class="${cls || ''}" data-k="${v}" aria-label="${v === 'back' ? 'Delete' : v === 'ok' ? 'Done' : v}">${label || v}</button>`;
  return '<div class="keypad">' +
    k('7') + k('8') + k('9') + k('÷', 'op') +
    k('4') + k('5') + k('6') + k('×', 'op') +
    k('1') + k('2') + k('3') + k('−', 'op') +
    k('.') + k('0') + k('back', 'fn', icon('backspace')) + k('+', 'op') +
    k('C', 'fn') + k('=', 'fn') + k('ok', 'ok', okLabel || 'Done') + '</div>';
}

// A sheet with a keypad sets sheet._key = (key) => {...}.
function keyFor(sheet, key) {
  if (sheet && sheet._key) sheet._key(key);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  e.preventDefault();
  keyFor(b.closest('.sheet'), b.dataset.k);
});
// A computer keyboard works too (handy when testing on a laptop).
document.addEventListener('keydown', (e) => {
  const sh = topSheet();
  if (!sh || !sh._key || e.metaKey || e.ctrlKey || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) return;
  const map = { '*': '×', x: '×', '/': '÷', '-': '−', '+': '+', '.': '.', ',': '.', Backspace: 'back', Enter: 'ok', '=': '=', Escape: 'esc', c: 'C' };
  const key = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
  if (!key) return;
  e.preventDefault();
  if (key === 'esc') closeSheet(); else keyFor(sh, key);
});

// Amount display for an expression: the sum, and the expression above it while it has operators.
function amountBoxHTML(expr, kind) {
  const v = Calc.evaluate(expr);
  return `<div class="expr">${Calc.hasOp(expr) ? esc(expr) : '&nbsp;'}</div>
    <div class="amt num ${kind || ''} ${!v ? 'zero' : ''}">${v === null ? 'Can’t divide by 0' : money(v || 0)}</div>`;
}

// Calculator sheet for any amount. Resolves with the number, or null if closed.
function askAmount(title, initial, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let expr = initial ? Calc.fromNumber(initial) : '';
    let result = null;
    const sh = openSheet(`<div class="sheet-head"><button class="icon-btn plain" data-a="close-sheet" aria-label="Close">${icon('close')}</button>
        <h2>${esc(title)}</h2><span class="head-space"></span></div>
      <div class="sheet-body">${opts.note ? `<p class="muted small center-text">${esc(opts.note)}</p>` : ''}
        <div class="amount-box"></div></div>${keypadHTML(opts.ok || 'Done')}`, { onClose: () => resolve(result) });
    const box = sh.querySelector('.amount-box');
    const draw = () => { box.innerHTML = amountBoxHTML(expr); };
    draw();
    sh._key = (k) => {
      if (k === 'ok') {
        const v = Calc.evaluate(expr);
        if (v === null || v < 0 || (!opts.allowZero && !v)) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); return; }
        result = v;
        closeSheet();
        return;
      }
      expr = Calc.press(expr, k);
      draw();
    };
  });
}

// ============================== period switchers ==============================
function monthSwitch(ym, action) {
  const atNow = ym >= thisMonth();
  return `<div class="month"><button class="icon-btn plain" data-a="${action}" data-d="-1" aria-label="Previous">${icon('back')}</button>
    <b class="ellipsis">${fmtMonth(ym)}</b>
    <button class="icon-btn plain" data-a="${action}" data-d="1" aria-label="Next" ${atNow ? 'disabled' : ''}>${icon('next')}</button></div>`;
}
function yearSwitch(y, action) {
  return `<div class="month"><button class="icon-btn plain" data-a="${action}" data-d="-1" aria-label="Previous year">${icon('back')}</button>
    <b>${y}</b><button class="icon-btn plain" data-a="${action}" data-d="1" aria-label="Next year" ${y >= +thisMonth().slice(0, 4) ? 'disabled' : ''}>${icon('next')}</button></div>`;
}

// ============================== charts ==============================
const tipMoney = (x) => (M.hideAmounts ? '••••' : money(x));
const axisMoney = (x) => (M.hideAmounts ? '•••' : moneyShort(x));

// Tapping a mark with data-tip shows its value above it, kept inside the chart.
document.addEventListener('click', (e) => {
  const hit = e.target.closest('.chart [data-tip]');
  $$('.chart .tip').forEach((t) => t.remove());
  if (!hit) return;
  const chart = hit.closest('.chart');
  const box = chart.getBoundingClientRect();
  const r = hit.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.textContent = hit.dataset.tip;
  chart.appendChild(tip);
  const scale = box.width / (Number(chart.dataset.w) || box.width);
  tip.style.top = (hit.dataset.top !== undefined ? Number(hit.dataset.top) * scale : r.top - box.top) + 'px';
  const half = tip.offsetWidth / 2;
  tip.style.left = Math.min(Math.max(r.left + r.width / 2 - box.left, half), box.width - half) + 'px';
});

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Bar with rounded top corners, anchored to the baseline.
function barPath(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function gridLines(max, L, W, T, ph) {
  return [0, 0.5, 1].map((f) => {
    const y = T + ph * (1 - f);
    return `<line class="grid" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text class="axis" x="${L - 6}" y="${y + 4}" text-anchor="end">${axisMoney(max * f)}</text>`;
  }).join('');
}

// Income and spending side by side per period. data: [{label, income, expense, tip, current}]
function columnsChart(data) {
  const W = 340;
  const H = 170;
  const L = 36;
  const B = 22;
  const T = 8;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.income, d.expense))));
  const ph = H - B - T;
  const gw = (W - L) / data.length;
  const bw = Math.min(14, gw / 2.6);
  let s = gridLines(max, L, W, T, ph);
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2;
    const hi = (d.income / max) * ph;
    const he = (d.expense / max) * ph;
    s += `<path d="${barPath(cx - bw - 1, T + ph - hi, bw, hi, 4)}" fill="var(--series-income)"/>`;
    s += `<path d="${barPath(cx + 1, T + ph - he, bw, he, 4)}" fill="var(--series-spend)"/>`;
    s += `<text class="axis${d.current ? ' now' : ''}" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    s += `<rect x="${L + gw * i}" y="0" width="${gw}" height="${H - B}" fill="transparent" data-tip="${esc(d.tip)}" data-top="${T + ph - Math.max(hi, he)}"/>`;
  });
  return `<div class="chart" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and spending">${s}</svg></div>
    <div class="legend"><span><i style="background:var(--series-income)"></i>Income</span><span><i style="background:var(--series-spend)"></i>Spending</span></div>`;
}

// One series of bars (e.g. spending per day). data: [{label, value, tip, current}]
function barsChart(data, labelEvery) {
  const W = 340;
  const H = 150;
  const L = 36;
  const B = 22;
  const T = 8;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const ph = H - B - T;
  const gw = (W - L) / data.length;
  const bw = Math.max(2, Math.min(12, gw - 2));
  let s = gridLines(max, L, W, T, ph);
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2;
    const h = (d.value / max) * ph;
    s += `<path d="${barPath(cx - bw / 2, T + ph - h, bw, h, Math.min(4, bw / 2))}" fill="${d.current ? 'var(--accent)' : 'var(--bar)'}"/>`;
    if (i % labelEvery === 0 || d.current) s += `<text class="axis${d.current ? ' now' : ''}" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    s += `<rect x="${L + gw * i}" y="0" width="${gw}" height="${H - B}" fill="transparent" data-tip="${esc(d.tip)}" data-top="${T + ph - h}"/>`;
  });
  return `<div class="chart" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending per day">${s}</svg></div>`;
}

// One line over time. points: [{label, value, tip}]
function lineChart(points, labelEvery) {
  const W = 340;
  const H = 150;
  const L = 40;
  const B = 22;
  const T = 10;
  const vals = points.map((p) => p.value);
  let lo = Math.min(0, ...vals);
  let hi = Math.max(...vals);
  if (hi === lo) hi = lo + 100;
  hi = hi > 0 ? niceMax(hi) : 0;
  if (lo < 0) lo = -niceMax(-lo);
  const ph = H - B - T;
  const xs = (i) => L + ((W - L - 6) * i) / Math.max(1, points.length - 1);
  const ys = (v) => T + ph * (1 - (v - lo) / (hi - lo));
  let s = '';
  [lo, (lo + hi) / 2, hi].forEach((v) => {
    s += `<line class="grid" x1="${L}" x2="${W}" y1="${ys(v)}" y2="${ys(v)}"/><text class="axis" x="${L - 6}" y="${ys(v) + 4}" text-anchor="end">${axisMoney(v)}</text>`;
  });
  const pts = points.map((p, i) => `${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ');
  const base = ys(Math.min(Math.max(0, lo), hi));
  s += `<polygon points="${xs(0)},${base} ${pts} ${xs(points.length - 1)},${base}" fill="var(--brand)" opacity=".18"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="var(--bar)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const last = points.length - 1;
  s += `<circle cx="${xs(last)}" cy="${ys(points[last].value)}" r="4" fill="var(--bar)" stroke="var(--card)" stroke-width="2"/>`;
  points.forEach((p, i) => {
    if (i % labelEvery === 0 || i === last) s += `<text class="axis" x="${xs(i)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`;
    const w = (W - L) / points.length;
    s += `<rect x="${xs(i) - w / 2}" y="0" width="${w}" height="${H - B}" fill="transparent" data-tip="${esc(p.tip)}" data-top="${ys(p.value)}"/>`;
  });
  return `<div class="chart" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance over the month">${s}</svg></div>`;
}

// Ranked rows, largest first, one colour: emoji, name, share and amount above a thin bar.
// rows: [{emoji, label, value, pct, attrs}]
function rankList(rows, cls) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return '<div class="rank">' + rows.map((r) => `<button class="rank-row" ${r.attrs || ''}>
      <span class="bubble sm">${r.emoji}</span>
      <span class="grow"><span class="spread"><span class="ellipsis">${r.label} <span class="muted small">${r.pct}</span></span><b class="num">${amt(r.value)}</b></span>
      <span class="bar-track"><span class="bar ${cls || ''}" style="width:${Math.max(1, (r.value / max) * 100).toFixed(1)}%"></span></span></span>
      ${icon('next')}</button>`).join('') + '</div>';
}

function meter(b) {
  const w = b.budget ? Math.min(100, b.pct * 100) : 0;
  return `<div class="meter ${b.level === 'over' ? 'over' : b.level === 'warn' ? 'warn' : ''}"><i style="width:${w.toFixed(1)}%"></i></div>`;
}

function budgetStatus(b) {
  if (b.level === 'over') return `<span class="status over">❗ Over by ${amt(-b.left)}</span>`;
  if (b.level === 'warn') return `<span class="status warn">⚠️ ${amt(b.left)} left</span>`;
  return `<span class="status ok">${amt(b.left)} left</span>`;
}
