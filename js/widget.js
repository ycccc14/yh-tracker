// Home Screen widgets. A web app can't draw one itself, so two small helpers do: a Scriptable script on
// iPhone (web/widget/scriptable.js) and a tiny Android app (android-widget/). Both read the same thing:
// a short summary this phone seals with the widget key and uploads after each sync. The server can't
// open it, and the widget's token can fetch only that summary, never the records.
// settings 'widget' = { t: token, k: key }, so a second phone keeps the same widgets up to date.
'use strict';

const WIDGET_APK = 'widget/my-tracker-widget.apk';
const SCRIPTABLE_APP = 'https://apps.apple.com/app/scriptable/id1405459188';
let widgetScript = ''; // loaded when the screen opens: iPhones only copy straight from the tap

const widgetCfg = () => { const w = setting('widget'); return w && w.t && w.k ? w : null; };
const widgetCode = (w) => `MTW1|${CFG.api}|${w.t}|${w.k}`;

function widgetSummary() {
  const ym = thisMonth();
  const mt = monthTotals(ym);
  const p = Theme.palette(Theme.read(setting('theme')).color, false);
  return { v: 1, month: MONTHS_LONG[+ym.slice(5) - 1].slice(0, 3), cur: setting('currency') || 'RM', expense: mt.expense, income: mt.income,
    balance: netWorth().net, color: p.brand, ink: p['brand-ink'] };
}

// After a sync: uploads the summary if it changed (a new record, a new month, a new colour).
async function pushWidget() {
  const w = widgetCfg();
  if (!w || CFG.demo) return;
  const summary = widgetSummary();
  const sent = w.t + JSON.stringify(summary);
  if (sent === M.widgetSent) return;
  await api('widgetPut', { t: w.t, data: await Crypt.sealJson(await Crypt.dataKey(w.k), summary) });
  M.widgetSent = sent;
  persist();
}

function loadWidgetScript() {
  if (widgetScript) return;
  fetch('widget/scriptable.js').then((r) => (r.ok ? r.text() : '')).then((t) => { widgetScript = t; }).catch(() => {});
}

function widgetScreen() {
  const w = widgetCfg();
  if (w) loadWidgetScript();
  const head = screenHead('Home Screen widget', { back: 'settings' });
  const toggle = `<section class="card flush"><div class="item"><span class="bubble">📊</span><span class="grow"><span class="title">Widget</span>
      <span class="meta">${CFG.demo ? 'Not in the preview' : 'This month’s spending and income, and your balance. Anyone who sees your Home Screen sees these numbers.'}</span></span>
      <label class="switch"><input type="checkbox" data-change="widget-toggle" ${w ? 'checked' : ''} ${CFG.demo ? 'disabled' : ''} aria-label="Widget"><i></i></label></div></section>`;
  if (!w) return head + toggle;
  const iphone = `<section class="card stack"><h2>iPhone</h2><ol class="steps">
      <li><span>Get the free app <a class="link" href="${SCRIPTABLE_APP}" target="_blank" rel="noopener">Scriptable</a> from the App Store.</span></li>
      <li><span>Tap <b>Copy script</b> below.</span></li>
      <li><span>In Scriptable tap <b>＋</b>, paste, and tap <b>Done</b>.</span></li>
      <li><span>Touch and hold your Home Screen, tap <b>Edit ▸ Add Widget</b>, pick <b>Scriptable</b> (the wide size) and add it.</span></li>
      <li><span>Touch and hold the new widget, tap <b>Edit Widget</b>, and choose your script under <b>Script</b>.</span></li></ol>
      <button class="btn primary block" data-a="widget-copy-script">Copy script</button></section>`;
  const android = `<section class="card stack"><h2>Android</h2><ol class="steps">
      <li><span><a class="link" href="${WIDGET_APK}" target="_blank" rel="noopener">Download the widget app</a> and install it. Your phone will ask you to allow this once.</span></li>
      <li><span>Tap <b>Copy code</b> below.</span></li>
      <li><span>Touch and hold your Home Screen, tap <b>Widgets</b>, and add <b>My Tracker Widget</b>.</span></li>
      <li><span>Tap the new widget, then <b>Paste</b> and <b>Connect</b>.</span></li></ol>
      <button class="btn primary block" data-a="widget-copy-code">Copy code</button></section>`;
  const note = '<p class="muted small center-text">The widget updates by itself, usually within 30 minutes of a change. The code and script are like a key to these numbers, so keep them to yourself. Turning the widget off makes them stop working.</p>';
  return head + toggle + (isIOS() ? iphone + android : android + iphone) + note;
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch (e) {
    toast('Couldn’t copy. Please try again.');
  }
}

actions['widget-copy-code'] = () => copyText(widgetCode(widgetCfg()), 'Code copied ✓');
actions['widget-copy-script'] = () => {
  if (!widgetScript) { loadWidgetScript(); toast('Still loading. Tap again in a moment.'); return; }
  copyText(widgetScript.replace('__WIDGET_CODE__', widgetCode(widgetCfg())), 'Script copied ✓');
};

actions['widget-toggle'] = async (el) => {
  const w = widgetCfg();
  if (el.checked) {
    put('settings', { id: 'widget', value: { t: Crypt.newKey(), k: Crypt.newKey() } }); // the next sync uploads the summary
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
