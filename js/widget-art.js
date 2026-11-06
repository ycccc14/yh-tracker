// Draws every Home Screen widget as a picture. The app paints it here and the widgets only display it,
// so a design looks the same on both phones, the preview is exactly what appears, and a new design
// needs no update on the phones' side. The Small, Wide and Big sizes are drawn for 2x screens.
'use strict';

const WidgetArt = (() => {
  const SIZES = { s: { w: 170, h: 170, name: 'Small' }, m: { w: 360, h: 170, name: 'Wide' }, l: { w: 360, h: 380, name: 'Big' } };
  const PAD = 16;
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Roboto, "Helvetica Neue", sans-serif';
  const BACKS = [['paper', 'Paper'], ['white', 'White'], ['dark', 'Dark'], ['colour', 'Colour'], ['picture', 'Picture']];

  // ---- drawing helpers ----
  function text(g, str, x, y, size, opts) {
    const o = opts || {};
    const weight = o.bold ? 750 : 500;
    str = String(str);
    g.textAlign = o.align || 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = o.color;
    g.font = `${weight} ${size}px ${FONT}`;
    if (o.max) { // shrink long amounts to fit; shorten long names with an ellipsis once it's too small
      const least = Math.max(9, size * 0.6);
      while (size > least && g.measureText(str).width > o.max) { size -= 0.5; g.font = `${weight} ${size}px ${FONT}`; }
      while (str.length > 1 && g.measureText(str).width > o.max) str = str.slice(0, -2) + '…';
    }
    g.fillText(str, x, y);
  }
  function box(g, x, y, w, h, r, color) {
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  }
  function bar(g, x, y, w, h, part, color, track) {
    box(g, x, y, w, h, h / 2, track);
    if (part > 0) box(g, x, y, Math.max(h, w * Math.min(1, part)), h, h / 2, color);
  }
  function ring(g, cx, cy, r, width, part, color, track, emoji) {
    g.lineCap = 'round';
    g.lineWidth = width;
    g.strokeStyle = track;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    if (part > 0) {
      g.strokeStyle = color;
      g.beginPath();
      g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, part));
      g.stroke();
    }
    if (emoji) text(g, emoji, cx, cy + r * 0.34, r * 0.95, { align: 'center', color: '#000' });
  }
  const line = (g, x1, y, x2, color) => { g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke(); };

  // ---- the designs: each gets the canvas (g), the size (w, h), colours (p), numbers (d) and money format (f) ----
  function classic(c) {
    const { g, w, h, p, d, f, art } = c;
    const panel = Math.round(h * (h > 200 ? 0.4 : 0.47));
    if (art) { // sits on the panel, and stops short of the month sign
      const ah = Math.min(h - panel - 10, (w - 96) * art.height / art.width);
      g.drawImage(art, 8, h - panel - 10 - ah, ah * art.width / art.height, ah);
    }
    box(g, w - 76, 16, 60, 28, 7, p.sign);
    text(g, d.month, w - 46, 36, 15, { bold: true, align: 'center', color: p.signInk });
    box(g, 10, h - panel - 10, w - 20, panel, 16, p.fill);
    const col = (w - 20) / 3;
    [['Expenses', d.expense], ['Income', d.income], ['Balance', d.balance]].forEach(([name, v], i) => {
      const x = 10 + col * (i + 0.5);
      const mid = h - 10 - panel / 2;
      text(g, name, x, mid - 4, 12, { align: 'center', color: p.fillSoft });
      text(g, f(v), x, mid + 15, 15, { bold: true, align: 'center', color: p.fillInk, max: col - 8 });
    });
  }

  function balance(c) {
    const { g, w, h, p, d, f } = c;
    const big = h > 200;
    text(g, 'Balance', PAD, big ? 40 : 34, 14, { color: p.soft });
    text(g, f(d.balance), PAD, big ? 88 : 74, big ? 40 : w < 200 ? 26 : 34, { bold: true, color: p.ink, max: w - PAD * 2 });
    if (!big) { text(g, `${d.month}: spent ${f(d.expense)}`, PAD, h - 22, 13, { color: p.soft, max: w - PAD * 2 }); return; }
    const y = 124;
    [['Income', d.income, p.good], ['Spent', d.expense, p.ink], ['Net', d.net, d.net < 0 ? p.bad : p.good]].forEach(([name, v, color], i) => {
      line(g, PAD, y + i * 74, w - PAD, p.line);
      text(g, `${name} in ${d.month}`, PAD, y + i * 74 + 44, 16, { color: p.soft });
      text(g, f(v), w - PAD, y + i * 74 + 44, 22, { bold: true, align: 'right', color, max: w / 2 });
    });
  }

  function cashflow(c) {
    const { g, w, h, p, d, f } = c;
    const small = w < 200;
    text(g, `Cashflow · ${d.month}`, PAD, 32, 14, { bold: true, color: p.ink, max: w - PAD * 2 });
    text(g, f(d.net), PAD, small ? 74 : 76, small ? 26 : 34, { bold: true, color: d.net < 0 ? p.bad : p.good, max: w - PAD * 2 });
    if (h > 200) {
      const most = Math.max(d.income, d.expense, 1);
      [['Money in', d.income, p.good], ['Money out', d.expense, p.bad]].forEach(([name, v, color], i) => {
        const y = 130 + i * 110;
        text(g, name, PAD, y, 15, { color: p.soft });
        text(g, f(v), w - PAD, y, 18, { bold: true, align: 'right', color: p.ink, max: w / 2 });
        bar(g, PAD, y + 14, w - PAD * 2, 16, v / most, color, p.track);
      });
      return;
    }
    if (small) {
      text(g, `↗ ${f(d.income)}`, PAD, h - 42, 14, { color: p.ink, max: w - PAD * 2 });
      text(g, `↘ ${f(d.expense)}`, PAD, h - 20, 14, { color: p.ink, max: w - PAD * 2 });
      return;
    }
    text(g, `↗ ${f(d.income)} in`, PAD, h - 24, 15, { color: p.ink, max: w / 2 - PAD });
    text(g, `↘ ${f(d.expense)} out`, w - PAD, h - 24, 15, { align: 'right', color: p.ink, max: w / 2 - PAD });
  }

  function budget(c) {
    const { g, w, h, p, d, f } = c;
    const small = w < 200;
    text(g, 'Budget', PAD, 32, 14, { color: p.soft });
    text(g, d.month, w - PAD, 32, 14, { bold: true, align: 'right', color: p.ink });
    if (!d.budget) {
      text(g, 'No budget yet', PAD, h / 2 + 8, small ? 19 : 26, { bold: true, color: p.ink, max: w - PAD * 2 });
      text(g, 'Set one in My Tracker', PAD, h - 24, 13, { color: p.soft, max: w - PAD * 2 });
      return;
    }
    text(g, f(d.left) + ' left', PAD, 78, small ? 22 : 30, { bold: true, color: d.left < 0 ? p.bad : p.ink, max: w - PAD * 2 });
    bar(g, PAD, 98, w - PAD * 2, 12, d.spent / d.budget, d.left < 0 ? p.bad : p.accent, p.track);
    text(g, `${f(d.spent)} of ${f(d.budget)}`, PAD, h - 24, 13, { color: p.soft, max: w - PAD * 2 });
  }

  function category(c) {
    const { g, w, h, p, d, f } = c;
    const k = d.cat;
    if (!k) { text(g, 'Pick a category', PAD, h / 2, 16, { bold: true, color: p.ink, max: w - PAD * 2 }); return; }
    const part = k.budget ? k.spent / k.budget : 0;
    const left = k.budget ? k.left : -k.spent;
    if (w < 200) {
      ring(g, w / 2, 62, 40, 9, part, k.left < 0 ? p.bad : p.accent, p.track, k.icon);
      text(g, k.name, w / 2, 130, 14, { align: 'center', color: p.ink, max: w - PAD * 2 });
      text(g, f(k.budget ? left : k.spent), w / 2, 153, 18, { bold: true, align: 'center', color: left < 0 && k.budget ? p.bad : p.good, max: w - PAD * 2 });
      return;
    }
    text(g, k.name, PAD + 2, 44, 22, { bold: true, color: p.ink, max: w - 110 });
    ring(g, w - 56, 52, 34, 9, part, k.left < 0 ? p.bad : p.accent, p.track, k.icon);
    const col = (w - PAD * 2) / 3;
    [['Budget', k.budget, p.ink], ['Actual', k.spent, p.ink], ['Remaining', k.left, k.left < 0 ? p.bad : p.good]].forEach(([name, v, color], i) => {
      text(g, name, PAD + 2 + col * i, h - 50, 13, { color: p.soft });
      text(g, k.budget || i === 1 ? f(v) : '—', PAD + 2 + col * i, h - 24, 18, { bold: true, color, max: col - 6 });
    });
  }

  function networth(c) {
    const { g, w, h, p, d, f } = c;
    text(g, 'Net worth', PAD, 34, 17, { bold: true, color: p.ink });
    text(g, f(d.balance), w - PAD, 34, 19, { bold: true, align: 'right', color: p.ink, max: w / 2 });
    const most = Math.max(d.assets, d.debts, 1);
    const gap = h > 200 ? 130 : 56;
    const room = w - PAD * 2 - 96;
    [['Assets', d.assets, p.good], ['Debts', d.debts, p.bad]].forEach(([name, v, color], i) => {
      const y = (h > 200 ? 92 : 66) + i * gap;
      text(g, name, PAD, y, 13, { color: p.soft });
      box(g, PAD, y + 8, Math.max(14, room * v / most), h > 200 ? 18 : 13, 7, color);
      text(g, (i ? '−' : '') + f(v), w - PAD, y + 20, 14, { align: 'right', color: p.ink, max: 92 });
    });
  }

  function compare(c) {
    const { g, w, h, p, d, f } = c;
    const big = h > 200;
    const first = big ? 74 : 54;
    const step = big ? 92 : 37;
    const size = big ? 18 : 14;
    const cols = [w - PAD, w - PAD - (w - PAD * 2) * 0.32];
    text(g, d.prevMonth, cols[1], 30, 13, { bold: true, align: 'right', color: p.soft });
    text(g, d.month, cols[0], 30, 13, { bold: true, align: 'right', color: p.soft });
    [['Income', d.prevIncome, d.income], ['Expenses', d.prevExpense, d.expense], ['Cashflow', d.prevNet, d.net]].forEach(([name, was, now], i) => {
      const y = first + i * step;
      line(g, PAD, y - (big ? 46 : 19), w - PAD, p.line);
      text(g, name, PAD, y + (big ? -10 : 0), size, { bold: i === 2, color: p.ink, max: w * 0.3 });
      text(g, f(was), cols[1], y + (big ? -10 : 0), size, { align: 'right', color: p.soft, max: w * 0.28 });
      text(g, f(now), cols[0], y + (big ? -10 : 0), size, { bold: i === 2, align: 'right', color: p.ink, max: w * 0.28 });
    });
  }

  function top3(c) {
    const { g, w, h, p, d, f } = c;
    const list = d.cats.slice(0, h > 200 ? 6 : 3);
    if (!list.length) { text(g, 'Nothing spent yet', PAD, h / 2, 16, { bold: true, color: p.ink }); return; }
    const colors = [p.accent, '#E5678A', '#3AA7E0', '#8E6BE8', '#F0A531', '#2FB893'];
    const most = list[0].spent || 1;
    const per = 3;
    const rows = Math.ceil(list.length / per);
    const rowH = h / rows;
    list.forEach((k, i) => {
      const inRow = Math.min(per, list.length - Math.floor(i / per) * per);
      const cx = (w / inRow) * (i % per + 0.5);
      const top = Math.floor(i / per) * rowH + (rowH - 160) / 2;
      ring(g, cx, top + 54, 34, 8, k.budget ? k.spent / k.budget : k.spent / most, colors[i], p.track, k.icon);
      text(g, k.name, cx, top + 118, 13, { align: 'center', color: p.ink, max: w / per - 10 });
      text(g, f(k.spent), cx, top + 141, 16, { bold: true, align: 'center', color: p.good, max: w / per - 10 });
    });
  }

  function recent(c) {
    const { g, w, h, p, d, f } = c;
    text(g, 'Recent', PAD, 34, 17, { bold: true, color: p.ink });
    text(g, d.month, w - PAD, 34, 13, { align: 'right', color: p.soft });
    const rows = d.recent.slice(0, h > 200 ? 7 : 3);
    if (!rows.length) { text(g, 'No records yet', PAD, 90, 15, { color: p.soft }); return; }
    const step = (h - 56) / (h > 200 ? 7 : 3);
    rows.forEach((r, i) => {
      const y = 52 + i * step + step / 2 + 5;
      text(g, r.icon, PAD, y, 16, { color: '#000' });
      text(g, r.name, PAD + 28, y, 15, { color: p.ink, max: w * 0.5 });
      text(g, (r.type === 'income' ? '+' : r.type === 'expense' ? '−' : '') + f(r.amount), w - PAD, y, 15, { bold: true, align: 'right', color: r.type === 'income' ? p.good : p.ink, max: w * 0.34 });
    });
  }

  // Quick add: the buttons sit in the lower 55% in three equal columns, where the widgets put their tap areas.
  function quick(c) {
    const { g, w, h, p, d, f } = c;
    const top = Math.round(h * 0.45);
    if (h > 200) {
      text(g, 'Balance', PAD, 42, 15, { color: p.soft });
      text(g, f(d.balance), PAD, 92, 38, { bold: true, color: p.ink, max: w - PAD * 2 });
      text(g, `Today ${f(d.today)} · ${d.month} ${f(d.expense)}`, PAD, 130, 14, { color: p.soft, max: w - PAD * 2 });
    } else {
      text(g, `Today ${f(d.today)}`, PAD, 32, 14, { color: p.ink, max: w / 2 });
      text(g, f(d.balance), w - PAD, 32, 15, { bold: true, align: 'right', color: p.ink, max: w / 2 - PAD });
      text(g, `${d.month}: spent ${f(d.expense)}`, PAD, 58, 13, { color: p.soft, max: w - PAD * 2 });
    }
    const col = (w - 24) / 3;
    [['＋', 'Expense'], ['＋', 'Income'], ['⇄', 'Transfer']].forEach(([mark, name], i) => {
      const x = 12 + col * i + 3;
      const bw = col - 6;
      const bh = h - top - 12;
      box(g, x, top, bw, bh, 14, p.fill);
      text(g, mark, x + bw / 2, top + bh / 2 - 1, 20, { bold: true, align: 'center', color: p.fillInk });
      text(g, name, x + bw / 2, top + bh / 2 + 19, 13, { bold: true, align: 'center', color: p.fillInk, max: bw - 8 });
    });
  }

  const DESIGNS = {
    classic: { name: 'Classic', sizes: 'ml', draw: classic },
    balance: { name: 'Balance', sizes: 'sml', draw: balance },
    cashflow: { name: 'Cashflow', sizes: 'sml', draw: cashflow },
    budget: { name: 'Budget', sizes: 'sm', draw: budget },
    category: { name: 'Category', sizes: 'sm', draw: category },
    networth: { name: 'Net worth', sizes: 'ml', draw: networth },
    compare: { name: 'This vs last month', sizes: 'ml', draw: compare },
    top3: { name: 'Top spending', sizes: 'ml', draw: top3 },
    recent: { name: 'Recent', sizes: 'ml', draw: recent },
    quick: { name: 'Quick add', sizes: 'ml', draw: quick, buttons: true },
  };
  const designsFor = (size) => Object.keys(DESIGNS).filter((id) => DESIGNS[id].sizes.includes(size));

  // ---- colours for a background ----
  function colours(back, color) {
    const light = Theme.palette(color, false);
    const dark = Theme.palette(color, true);
    const onDark = { ink: '#FFFFFF', soft: 'rgba(255,255,255,.74)', accent: dark.brand, good: '#5BE08F', bad: '#FF9C9C', track: 'rgba(255,255,255,.2)', line: 'rgba(255,255,255,.18)', fill: dark.brand, fillInk: dark['brand-ink'], fillSoft: dark['brand-ink'], sign: '#FFFFFF', signInk: '#1E2A3A' };
    if (back === 'dark') return Object.assign({ bg: '#17191E' }, onDark);
    if (back === 'picture') return Object.assign({ bg: '#17191E' }, onDark);
    if (back === 'colour') {
      const k = light['brand-ink'];
      const soft = k === '#FFFFFF' ? 'rgba(255,255,255,.76)' : 'rgba(0,0,0,.62)';
      const track = k === '#FFFFFF' ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.14)';
      return { bg: light.brand, ink: k, soft, accent: k, good: k, bad: k, track, line: track, fill: track, fillInk: k, fillSoft: soft, sign: '#FFFFFF', signInk: '#1E2A3A' };
    }
    return { bg: back === 'white' ? '#FFFFFF' : '#F7F4EE', ink: '#1E2A3A', soft: '#667085', accent: light.accent, good: '#1E8E4E', bad: '#D33A3A', track: 'rgba(0,0,0,.09)', line: 'rgba(0,0,0,.09)', fill: light.brand, fillInk: light['brand-ink'], fillSoft: light['brand-ink'], sign: '#FFFFFF', signInk: '#1E2A3A' };
  }

  // Draws one widget on a canvas. style = { back, color, short }, pics = { art, picture } (loaded images).
  function paint(canvas, size, design, style, data, pics, scale) {
    const { w, h } = SIZES[size];
    canvas.width = w * scale;
    canvas.height = h * scale;
    const g = canvas.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    const back = style.back === 'picture' && !(pics && pics.picture) ? 'dark' : style.back;
    const p = colours(back, style.color);
    g.fillStyle = p.bg;
    g.fillRect(0, 0, w, h);
    if (back === 'picture') {
      const pic = pics.picture;
      const zoom = Math.max(w / pic.width, h / pic.height);
      g.drawImage(pic, (w - pic.width * zoom) / 2, (h - pic.height * zoom) / 2, pic.width * zoom, pic.height * zoom);
      g.fillStyle = 'rgba(0,0,0,.45)'; // keeps white text readable on any picture
      g.fillRect(0, 0, w, h);
    }
    const f = (v) => shortOrFull(v, data.cur, style.short);
    (DESIGNS[design] || DESIGNS.balance).draw({ g, w, h, p, d: data, f, art: pics && pics.art });
  }

  function shortOrFull(v, cur, short) {
    const n = Math.abs(Number(v) || 0);
    const sign = v < 0 ? '−' : '';
    if (short && n >= 1000) return `${sign}${cur}${n >= 1e6 ? (n / 1e6).toFixed(1) + 'm' : (n / 1e3).toFixed(1) + 'k'}`;
    return sign + cur + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return { SIZES, DESIGNS, BACKS, designsFor, paint, shortOrFull };
})();
