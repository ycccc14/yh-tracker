// The app's look: light or dark, and one main colour that every other colour is worked out from.
// Loaded in <head>, before the stylesheet, so a saved look is there from the first frame (no flash of green).
// The choice is the settings record 'theme' = { mode, color }, so it follows the user to other phones;
// localStorage only keeps a copy for that first frame, because the records load later.
'use strict';

const Theme = (() => {
  const DEFAULT = '#93C572'; // pistachio: uses the hand-picked colours in app.css as they are
  const PRESETS = [['Pistachio', DEFAULT], ['Sky', '#5B9BD5'], ['Lavender', '#A78BDA'], ['Sakura', '#F09BB5'],
    ['Coral', '#F28B6B'], ['Butter', '#EFC94C'], ['Teal', '#3FB8AF'], ['Graphite', '#6B7280']];
  const MODES = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  const SLIDER_SAT = 62; // the "your own colour" sliders pick the hue and the shade at this strength
  const SHADES = [30, 80];

  // ---- colour maths ----
  const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function toHsl(hex) {
    const [r, g, b] = toRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    if (!d) return [0, 0, l * 100];
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, d / (1 - Math.abs(2 * l - 1)) * 100, l * 100];
  }
  function hsl(h, s, l) {
    s /= 100;
    l = Math.min(100, Math.max(0, l)) / 100;
    const a = s * Math.min(l, 1 - l);
    const part = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return ('#' + part(0) + part(8) + part(4)).toUpperCase();
  }
  function luminance(hex) {
    const [r, g, b] = toRgb(hex).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  }
  const worst = (c, against) => Math.min(...against.map((b) => contrast(c, b)));
  const rgba = (hex, alpha) => `rgba(${toRgb(hex).join(', ')}, ${alpha})`;

  // Walks the lightness (dir -1 darker, +1 lighter) until the colour stands out enough from all of `against`.
  function fit(h, s, l, against, ratio, dir) {
    let c = hsl(h, s, l);
    while ((dir > 0 ? l < 100 : l > 0) && worst(c, against) < ratio) { l += dir; c = hsl(h, s, l); }
    return c;
  }
  // Text for these backgrounds: a dark shade of the colour if it reads, else white, else whichever reads best.
  function readable(h, s, backs) {
    for (const c of [hsl(h, Math.min(s, 50), 12), '#FFFFFF']) if (worst(c, backs) >= 4.5) return c;
    return worst('#000000', backs) >= worst('#FFFFFF', backs) ? '#000000' : '#FFFFFF';
  }

  // Every colour token for a main colour, for light or dark. Text always keeps at least 4.5:1 against what's
  // behind it, whatever colour is chosen: a very pale or very dark choice is nudged, never left unreadable.
  function palette(color, dark) {
    const [h, s, l] = toHsl(color);
    const gray = Math.min(s, 40) * 0.6;
    const t = dark
      ? { bg: hsl(h, gray * 0.6, 7), card: hsl(h, gray * 0.6, 11), ink: hsl(h, gray, 94), 'ink-2': hsl(h, gray * 0.6, 78), line: hsl(h, gray * 0.6, 18),
        soft: hsl(h, gray * 0.6, 15), 'brand-soft': hsl(h, Math.min(s, 35), 16) }
      : { bg: hsl(h, gray, 95), card: '#FFFFFF', ink: hsl(h, gray, 13), 'ink-2': hsl(h, gray * 0.5, 30), line: hsl(h, gray, 90),
        soft: hsl(h, gray * 1.4, 94), 'brand-soft': hsl(h, Math.min(s, 50), 90) };
    const dir = dark ? 1 : -1;
    t.muted = fit(h, gray * 0.5, dark ? 58 : 48, [t.card, t.bg], 4.5, dir);
    t.brand = fit(h, s, l, [t.card], dark ? 3 : 1.5, dir);
    const bl = toHsl(t.brand)[2];
    t['brand-ink'] = readable(h, s, [t.brand]);
    t['brand-deep'] = fit(h, s, bl + 8 * dir, [t.card], 2, dir);
    t['on-soft'] = dark ? t.ink : hsl(h, Math.min(s, 50), 14);
    t.accent = fit(h, s, bl, [t.card, t.bg, t.soft, t['brand-soft']], 4.5, dir);
    t.bar = fit(h, s, bl, [t.card], 3, dir);
    if (dark) {
      t['hero-1'] = hsl(h, Math.min(s, 42), 27);
      t['hero-2'] = hsl(h, Math.min(s, 42), 19);
      t['on-hero'] = t.ink;
      t.glass = 'rgba(0, 0, 0, .22)';
      t['hero-glow'] = 'transparent';
    } else {
      let top = Math.min(bl + 8, 88);
      let low = bl - 6;
      let ink = readable(h, s, [hsl(h, s, top), hsl(h, s, low)]);
      while (low > 5 && worst(ink, [hsl(h, s, top), hsl(h, s, low)]) < 4.5) { // mid tones: go deep enough for white text
        top -= 3;
        low -= 3;
        ink = readable(h, s, [hsl(h, s, top), hsl(h, s, low)]);
      }
      t['hero-1'] = hsl(h, s, top);
      t['hero-2'] = hsl(h, s, low);
      t['on-hero'] = ink;
      t.glass = ink === '#FFFFFF' ? 'rgba(0, 0, 0, .22)' : 'rgba(255, 255, 255, .45)';
      t['hero-glow'] = rgba(t['brand-deep'], 0.25);
    }
    t['fab-glow'] = rgba(t.brand, 0.45);
    return t;
  }
  const TOKENS = Object.keys(palette(DEFAULT, false));

  // ---- the choice ----
  // Anything unknown falls back to the default, so a damaged record can't reach the styles.
  function read(t) {
    t = t && typeof t === 'object' ? t : {};
    return { mode: MODES[t.mode] ? t.mode : 'auto', color: /^#[0-9a-f]{6}$/i.test(t.color) ? String(t.color).toUpperCase() : DEFAULT };
  }
  const presetName = (color) => (PRESETS.find((p) => p[1] === read({ color }).color) || [''])[0];
  const label = (t) => { t = read(t); return `${presetName(t.color) || 'Your own colour'} · ${MODES[t.mode]}`; };
  const fromSliders = (hue, shade) => hsl(hue, SLIDER_SAT, shade);
  function sliders(color) {
    const [h, , l] = toHsl(read({ color }).color);
    return [Math.round(h), Math.round(Math.min(SHADES[1], Math.max(SHADES[0], l)))];
  }

  // ---- on the page ----
  const browser = typeof document !== 'undefined';
  // Per app folder: the real app and the preview share a web address, and a look chosen in one stays there.
  const STORE = browser ? 'yh-theme:' + location.pathname.replace(/[^/]*$/, '') : '';
  const systemDark = browser && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let current = read();
  let previewing = false;

  // ---- the app's icon, in any colour ----
  const key = (color) => (PRESETS.find(([, c]) => c === color) || [''])[0].toLowerCase();
  // The preset closest in colour: Android's Home Screen icons are made in advance.
  function nearest(color) {
    const [h, s] = toHsl(color);
    const gap = (c) => {
      const [ch, cs] = toHsl(c);
      if (s < 20 || cs < 20) return s < 20 && cs < 20 ? 0 : 400;
      const d = Math.abs(h - ch);
      return Math.min(d, 360 - d);
    };
    return PRESETS.reduce((best, p) => (gap(p[1]) < gap(best[1]) ? p : best))[0];
  }
  // The same drawing as tools/make-icons.py, for the user's own colour. Presets are ready-made files.
  const drawn = {};
  function drawIcon(color) {
    if (drawn[color]) return drawn[color];
    const [h, s, l] = toHsl(color);
    const c = document.createElement('canvas');
    c.width = c.height = 180;
    const g = c.getContext('2d');
    const u = 180 / 1024;
    const fill = g.createLinearGradient(0, 0, 0, 180);
    fill.addColorStop(0, hsl(h, s, l + 8));
    fill.addColorStop(1, hsl(h, s, l - 12));
    g.fillStyle = fill;
    g.fillRect(0, 0, 180, 180);
    const box = (x1, y1, x2, y2, r, color2) => { g.fillStyle = color2; g.beginPath(); g.roundRect(x1 * u, y1 * u, (x2 - x1) * u, (y2 - y1) * u, r * u); g.fill(); };
    box(212, 304, 812, 778, 86, 'rgba(0, 0, 0, .16)');
    box(212, 286, 812, 760, 86, '#FFFFFF');
    box(300, 222, 700, 330, 40, 'rgba(255, 255, 255, .78)');
    box(640, 448, 852, 598, 60, hsl(h, s, 90));
    g.fillStyle = hsl(h, s, 30);
    g.beginPath();
    g.arc(746 * u, 523 * u, 32 * u, 0, Math.PI * 2);
    g.fill();
    drawn[color] = c.toDataURL('image/png');
    return drawn[color];
  }
  function iconUrl(color) {
    const c = color || current.color;
    if (c === DEFAULT) return 'icons/icon-180.png';
    return key(c) ? `icons/c-${key(c)}.png` : drawIcon(c);
  }
  // A link from Appearance carries the colour, so "Add to Home Screen" in Safari takes that icon.
  const asked = browser ? /[?&]icon=([0-9a-f]{6})/i.exec(location.search) : null;

  function paint() {
    const root = document.documentElement;
    const dark = current.mode === 'dark' || (current.mode === 'auto' && !!systemDark && systemDark.matches);
    const own = current.color === DEFAULT ? null : palette(current.color, dark);
    root.dataset.mode = dark ? 'dark' : 'light';
    TOKENS.forEach((k) => { if (own) root.style.setProperty('--' + k, own[k]); else root.style.removeProperty('--' + k); });
    const bar = own ? own.bg : dark ? '#121611' : '#F4F8F0'; // the phone's status bar
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bar));
    if (window.MyTrackerApp) window.MyTrackerApp.setBars(bar, dark); // the Android app paints its own bars
    const icon = iconUrl(asked ? '#' + asked[1].toUpperCase() : current.color);
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((l) => l.setAttribute('href', icon));
  }
  function remember(t) {
    try {
      if (t) localStorage.setItem(STORE, JSON.stringify(t)); else localStorage.removeItem(STORE);
    } catch (e) { /* private mode: the look is still set from the records once they load */ }
  }
  // Shows a look while a slider moves, without keeping it.
  function preview(t) {
    previewing = true;
    current = read(t);
    paint();
  }
  function set(t) {
    previewing = false;
    current = read(t);
    remember(current);
    paint();
  }
  // Called on every redraw: picks up a look chosen on another phone (or a first download after signing in).
  function follow(t) {
    const next = read(t);
    if (!previewing && (next.mode !== current.mode || next.color !== current.color)) set(next);
  }
  // Signed out: back to the default, and nothing of this user's left for the next one.
  function clear() {
    previewing = false;
    current = read();
    remember(null);
    paint();
  }

  if (browser) {
    try { current = read(JSON.parse(localStorage.getItem(STORE))); } catch (e) { /* nothing saved yet */ }
    paint();
    if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', paint);
  }

  return { DEFAULT, PRESETS, MODES, SHADES, palette, contrast, read, label, presetName, nearest, iconUrl, fromSliders, sliders, now: () => current, preview, set, follow, clear };
})();
if (typeof module !== 'undefined') module.exports = Theme;
