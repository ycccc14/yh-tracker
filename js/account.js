// Logins (sign in, sign up with an invite code, forgotten password), the account part of Settings,
// Telegram linking, and answering the owner's requests for a copy of the data.
'use strict';

const deviceName = () => (isIOS() ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Computer');
const val = (id) => ($('#' + id) || {}).value || '';

function formError(msg) {
  const el = $('#form-err');
  if (el) el.textContent = msg || '';
}

// Runs an async form step with its button showing progress; errors appear under the form.
async function busy(el, label, fn) {
  const old = el.textContent;
  el.disabled = true;
  el.textContent = label;
  formError('');
  try {
    await fn();
  } catch (e) {
    formError(e.message);
  } finally {
    if (document.body.contains(el)) { el.disabled = false; el.textContent = old; }
  }
}

const lockNote = '<p class="muted small">🔒 Your data is encrypted with your password before it’s backed up online. YC can only get a copy when you approve.</p>';
const errLine = '<p class="small" id="form-err" style="color:var(--bad);min-height:18px"></p>';

// ============================== sign in ==============================
// Each server call takes ~2 s, so the password salt is fetched while the username is being typed.
const saltCache = {};
function saltFor(username) {
  const k = username.trim().toLowerCase();
  if (!saltCache[k]) saltCache[k] = api('loginStart', { username: username.trim() }).then((r) => r.salt).catch((e) => { delete saltCache[k]; throw e; });
  return saltCache[k];
}

function showWelcome(note) {
  cover(`${appIcon}<div><h1>YH Tracker</h1><p class="muted" style="margin-top:6px">Sign in to see your money on any phone.</p></div>
    ${note ? `<div class="banner warn"><p>${esc(note)}</p></div>` : ''}
    <section class="card stack" style="text-align:left">
      <label class="field"><span>Username</span><input class="input" id="in-user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="30"></label>
      <label class="field"><span>Password</span><input class="input" id="in-pass" type="password" autocomplete="current-password" maxlength="100"></label>
      <button class="btn primary block" data-a="signin-go">Sign in</button>${errLine}
      <button class="link" data-a="show-forgot">Forgot password?</button>
    </section>
    <section class="card stack"><p class="muted">New here?</p><button class="btn block" data-a="show-signup">I have an invite code</button></section>
    ${lockNote}`);
  let timer = 0;
  const user = $('#in-user');
  const early = () => { clearTimeout(timer); if (user.value.trim().length > 1) saltFor(user.value).catch(() => {}); };
  user.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(early, 500); });
  $('#in-pass').addEventListener('focus', early);
}
actions['show-welcome'] = () => showWelcome();

actions['signin-go'] = (el) => busy(el, 'Signing in…', async () => {
  const username = val('in-user').trim();
  const password = val('in-pass');
  if (!username || !password) throw new Error('Type your username and password.');
  const salt = await saltFor(username);
  const k = await Crypt.fromPassword(password, salt);
  const r = await api('login', { username, auth: k.auth, device: deviceName() });
  await startSession(r, await Crypt.unwrapKey(r.keyPw, k.kek), false, salt);
});

// After signing in on this phone: a clean slate, then the app opens straight away while everything
// comes down from the backup (start() syncs; Home says so until the first sync is done).
async function startSession(r, dk, fresh, salt) {
  await wipeLocal();
  M.token = r.token;
  M.dk = dk;
  M.user = { id: r.userId, username: r.username, name: r.name || '', telegram: !!r.telegram, salt };
  if (fresh) seedDefaults(r.name);
  await persist(true);
  history.replaceState(null, '', location.pathname + '#home');
  start();
}

// ============================== sign up ==============================
function showSignup() {
  cover(`${appIcon}<div><h1>Create your account</h1><p class="muted" style="margin-top:6px">You need the invite code YC sent you.</p></div>
    <section class="card stack" style="text-align:left">
      <label class="field"><span>Invite code</span><input class="input code-input" id="up-invite" maxlength="9" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="one-time-code" autocorrect="off" spellcheck="false"></label>
      <label class="field"><span>Your name</span><input class="input" id="up-name" maxlength="30" autocomplete="given-name" placeholder="e.g. YH"></label>
      <label class="field"><span>Username</span><input class="input" id="up-user" maxlength="30" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="letters and numbers"></label>
      <label class="field"><span>Password</span><input class="input" id="up-pass" type="password" autocomplete="new-password" maxlength="100" placeholder="at least 8 characters"></label>
      <label class="field"><span>Password again</span><input class="input" id="up-pass2" type="password" autocomplete="new-password" maxlength="100"></label>
      <button class="btn primary block" data-a="signup-go">Create account</button>${errLine}
      <button class="link" data-a="show-welcome">I already have an account</button>
    </section>${lockNote}`);
  codeField('up-invite');
}
actions['show-signup'] = () => showSignup();

// XXXX-XXXX as you type.
function codeField(id) {
  const el = $('#' + id);
  el.addEventListener('input', () => {
    const raw = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    el.value = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
  });
}

function checkNewPassword(a, b) {
  if (a.length < 8) throw new Error('Use at least 8 characters for the password.');
  if (a !== b) throw new Error('The two passwords are different.');
}

// The data key is made here, on the phone. The server gets it only sealed: once with the password
// key, once with a backup key (kept apart from the data) for a forgotten password and approved downloads.
actions['signup-go'] = (el) => busy(el, 'Creating…', async () => {
  const invite = val('up-invite');
  const name = val('up-name').trim();
  const username = val('up-user').trim();
  const password = val('up-pass');
  if (invite.replace(/[^A-Za-z0-9]/g, '').length !== 8) throw new Error('The invite code has 8 letters and numbers.');
  if (!name) throw new Error('Type your name.');
  if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) throw new Error('Username: 2 to 30 letters, numbers, dots or dashes (no spaces).');
  checkNewPassword(password, val('up-pass2'));
  const salt = Crypt.newSalt();
  const k = await Crypt.fromPassword(password, salt);
  const dk = Crypt.newKey();
  const backupKey = Crypt.newKey();
  const r = await api('signup', { invite, name, username, salt, auth: k.auth, keyPw: await Crypt.wrapKey(dk, k.kek),
    keyBackup: await Crypt.wrapKey(dk, backupKey), backupKey, device: deviceName() });
  await startSession(Object.assign({ name }, r), dk, true, salt);
  setTimeout(() => toast('Tip: link Telegram in Settings, so you can reset a forgotten password', 4500), 1500);
});

// ============================== forgotten password ==============================
let resetUser = '';
function showForgot(step) {
  if (step !== 2) {
    cover(`${appIcon}<div><h1>Forgot password</h1><p class="muted" style="margin-top:6px">We’ll send a code to your Telegram. No Telegram? Ask YC for a reset code.</p></div>
      <section class="card stack" style="text-align:left">
        <label class="field"><span>Username</span><input class="input" id="fp-user" maxlength="30" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(resetUser)}"></label>
        <button class="btn primary block" data-a="forgot-send">Send code to Telegram</button>
        <button class="btn block" data-a="forgot-have">I already have a code</button>${errLine}
        <button class="link" data-a="show-welcome">Back to sign in</button>
      </section>`);
    return;
  }
  cover(`${appIcon}<div><h1>New password</h1><p class="muted" style="margin-top:6px">For <b>${esc(resetUser)}</b>. Type the code and choose a new password.</p></div>
    <section class="card stack" style="text-align:left">
      <label class="field"><span>Code</span><input class="input code-input" id="fp-code" maxlength="9" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="one-time-code" autocorrect="off" spellcheck="false"></label>
      <label class="field"><span>New password</span><input class="input" id="fp-pass" type="password" autocomplete="new-password" maxlength="100" placeholder="at least 8 characters"></label>
      <label class="field"><span>New password again</span><input class="input" id="fp-pass2" type="password" autocomplete="new-password" maxlength="100"></label>
      <button class="btn primary block" data-a="forgot-go">Save new password</button>${errLine}
      <button class="link" data-a="show-forgot">Back</button>
    </section><p class="muted small">Other phones signed in to this account will be signed out.</p>`);
  codeField('fp-code');
}
actions['show-forgot'] = () => showForgot(1);
const takeResetUser = () => {
  resetUser = val('fp-user').trim();
  if (!resetUser) throw new Error('Type your username.');
};
actions['forgot-send'] = (el) => busy(el, 'Sending…', async () => {
  takeResetUser();
  const r = await api('resetStart', { username: resetUser });
  showForgot(2);
  toast(r.message, 5000);
});
actions['forgot-have'] = (el) => busy(el, '…', async () => { takeResetUser(); showForgot(2); });
actions['forgot-go'] = (el) => busy(el, 'Saving…', async () => {
  const code = val('fp-code');
  const password = val('fp-pass');
  if (code.replace(/[^A-Za-z0-9]/g, '').length !== 8) throw new Error('The code has 8 letters and numbers.');
  checkNewPassword(password, val('fp-pass2'));
  const f = await api('resetFinish', { username: resetUser, code });
  const dk = await Crypt.unwrapKey(f.keyBackup, f.backupKey);
  const salt = Crypt.newSalt();
  const k = await Crypt.fromPassword(password, salt);
  const r = await api('resetSave', { resetToken: f.resetToken, salt, auth: k.auth, keyPw: await Crypt.wrapKey(dk, k.kek), device: deviceName() });
  await startSession(r, dk, false, salt);
  toast('Password changed ✓', 3000);
});

// ============================== settings: account ==============================
actions['sign-out'] = async () => {
  const waiting = unsentCount();
  const ok = CFG.demo ? await confirmSheet('Clear the preview data?', 'The sample data is removed. Open the preview again for a fresh copy.', 'Clear', true)
    : await confirmSheet('Sign out on this phone?', (waiting ? `${waiting} change(s) haven’t uploaded yet and will be lost. ` : '') +
      'Everything else is backed up online. Sign in again any time to get it back.', 'Sign out', true);
  if (!ok) return;
  try { await api('signOut'); } catch (e) { /* offline: the session is forgotten anyway */ }
  await wipeLocal();
  location.replace(location.pathname);
  location.reload();
};

actions['change-password'] = () => {
  openSheet(sheetHead('Change password') + `<div class="sheet-body">
      <label class="field"><span>Current password</span><input class="input" id="cp-old" type="password" autocomplete="current-password" maxlength="100"></label>
      <label class="field"><span>New password</span><input class="input" id="cp-new" type="password" autocomplete="new-password" maxlength="100" placeholder="at least 8 characters"></label>
      <label class="field"><span>New password again</span><input class="input" id="cp-new2" type="password" autocomplete="new-password" maxlength="100"></label>${errLine}
    </div><div class="sheet-foot"><button class="btn primary block" data-a="change-password-go">Change password</button></div>`);
};
actions['change-password-go'] = (el) => busy(el, 'Saving…', async () => {
  checkNewPassword(val('cp-new'), val('cp-new2'));
  const oldSalt = M.user.salt || (await saltFor(M.user.username));
  const old = await Crypt.fromPassword(val('cp-old'), oldSalt);
  const salt = Crypt.newSalt();
  const k = await Crypt.fromPassword(val('cp-new'), salt);
  await api('changePassword', { oldAuth: old.auth, salt, auth: k.auth, keyPw: await Crypt.wrapKey(M.dk, k.kek) });
  M.user = Object.assign({}, M.user, { salt });
  persist();
  closeSheet();
  toast('Password changed ✓');
});

// Telegram: codes for a forgotten password or a data request (when this phone can't be used).
actions['telegram'] = () => {
  const linked = !!(M.user && M.user.telegram);
  const sh = openSheet(sheetHead('Telegram') + `<div class="sheet-body">
      <div class="center-text"><span class="hero-emoji">✈️</span><h2>${linked ? 'Telegram is linked' : 'Get codes in Telegram'}</h2></div>
      <p class="muted">Codes come here if you forget your password, or if YC asks for a copy of your data while you can’t use this phone.</p>
      <div id="tg-step"></div>${errLine}</div>`);
  const step = $('#tg-step', sh);
  step.innerHTML = linked ? '<button class="btn danger block" data-a="tg-unlink">Unlink Telegram</button>'
    : '<button class="btn primary block" data-a="tg-start">Link Telegram</button>';
};
actions['tg-start'] = (el) => busy(el, 'Preparing…', async () => {
  const r = await api('tgLinkStart');
  $('#tg-step').innerHTML = `<div class="stack"><section class="card"><ol class="steps"><li><span>Tap <b>Open Telegram</b>, then <b>Start</b> in Telegram.</span></li>
      <li><span>Come back here and tap <b>Done</b>.</span></li></ol></section>
    <a class="btn primary block" href="${esc(r.url)}" target="_blank" rel="noopener">✈️ Open Telegram</a>
    <button class="btn block" data-a="tg-check">Done</button></div>`;
});
actions['tg-check'] = (el) => busy(el, 'Checking…', async () => {
  const r = await api('tgLinkCheck');
  if (!r.linked) throw new Error('Not linked yet. In Telegram, tap Start (or send the message it shows), then tap Done again.');
  M.user = Object.assign({}, M.user, { telegram: true });
  persist();
  closeSheet();
  toast('Telegram linked ✓');
  render();
});
actions['tg-unlink'] = (el) => busy(el, 'Unlinking…', async () => {
  await api('tgUnlink');
  M.user = Object.assign({}, M.user, { telegram: false });
  persist();
  closeSheet();
  render();
});

// ============================== data requests ==============================
const REQ_STATUS = { pending: 'Waiting for your answer', approved: 'Approved (not downloaded yet)', declined: 'Declined', downloaded: 'Downloaded' };
const pendingRequests = () => (M.requests || []).filter((r) => r.status === 'pending');

function fmtWhen(ms) {
  const d = new Date(ms);
  return fmtDate(Shared.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()), true) + ', ' + Shared.pad(d.getHours()) + ':' + Shared.pad(d.getMinutes());
}

let shownReq = ''; // the request already shown since the app opened
let wantRequest = 0; // when a request notification was tapped: show the request after a fresh sync

function openRequest(r) {
  shownReq = r.id;
  const sh = openSheet(sheetHead('Data request') + `<div class="sheet-body">
      <div class="center-text"><span class="hero-emoji">📨</span><h2>YC asks for a copy of your data</h2><p class="muted small">${fmtWhen(r.asked)}</p></div>
      ${r.reason ? `<div class="banner"><p>“${esc(r.reason)}”</p></div>` : ''}
      <p class="muted">If you approve, YC can download <b>one</b> copy of your records as a spreadsheet file. Nobody else can. You’ll see here when it’s downloaded.</p>
    </div><div class="sheet-foot"><button class="btn primary block" data-a="request-answer" data-v="yes">Approve</button>
      <button class="btn block" data-a="request-answer" data-v="no">Decline</button></div>`);
  sh._st = r;
}
actions['request-answer'] = async (el) => {
  const r = sheetState();
  const approve = el.dataset.v === 'yes';
  el.disabled = true;
  try {
    await api('answerRequest', { id: r.id, approve });
    M.requests = (M.requests || []).map((x) => (x.id === r.id ? Object.assign({}, x, { status: approve ? 'approved' : 'declined', answered: Date.now() }) : x));
    persist();
    closeSheet();
    toast(approve ? 'Approved ✓ YC can download one copy' : 'Declined');
    render();
  } catch (e) {
    el.disabled = false;
    toast(e.message, 4000);
  }
};
actions['request-review'] = () => { const r = pendingRequests()[0]; if (r) openRequest(r); };
actions['requests'] = () => {
  const list = M.requests || [];
  openSheet(sheetHead('Data requests') + `<div class="sheet-body"><p class="muted">Each time YC asks for a copy of your data, it shows here.</p>
    ${list.length ? `<section class="card flush">${list.map((r) => `<div class="item"><span class="bubble">${r.status === 'downloaded' ? '📥' : r.status === 'declined' ? '🚫' : '📨'}</span>
      <span class="grow"><span class="title ellipsis">${REQ_STATUS[r.status] || esc(r.status)}</span><span class="meta ellipsis">Asked ${fmtWhen(r.asked)}${r.answered ? ' · ' + fmtWhen(r.answered) : ''}</span></span></div>`).join('')}</section>`
      : '<section class="card"><div class="empty">No requests yet.</div></section>'}</div>`);
};

// A waiting request opens by itself once each time the app opens (when nothing else is open),
// and straight away after tapping its notification.
function maybePromptRequest() {
  if (sheetStack.length || !$('#cover').hidden) return;
  const r = pendingRequests()[0];
  if (r && (wantRequest || shownReq !== r.id)) {
    wantRequest = 0;
    openRequest(r);
  } else if (!r && wantRequest && M.lastSync > wantRequest) {
    wantRequest = 0;
    toast('No request is waiting for you');
  }
}

function showRequestFromNotification() {
  wantRequest = Date.now();
  if (view.route !== 'home') go('home');
  sync();
  render();
}
