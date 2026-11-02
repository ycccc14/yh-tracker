// Encryption on the phone (WebCrypto). Every record is sealed with the user's data key (AES-256-GCM)
// before it leaves the phone, so the server only ever stores scrambled text.
//
// The password gives two separate keys (PBKDF2-SHA256): `auth` proves who you are to the server
// (it stores only a hash of it) and `kek` unlocks the data key. The kek never leaves the phone, so
// the server can't open the data with what it sees. The data key is also sealed with a random
// backup key that the server keeps apart from the data, for a forgotten password and approved
// downloads (tools/admin.js does the same steps in Node).
'use strict';
const Crypt = (function () {
  const subtle = crypto.subtle;
  const ITERATIONS = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64(s) {
    const t = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
    return Uint8Array.from(t, (c) => c.charCodeAt(0));
  }

  const aes = (raw) => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

  // iv (12 bytes) + ciphertext, as base64url.
  async function seal(key, bytes) {
    const iv = rand(12);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return b64(out);
  }
  async function open(key, text) {
    const all = unb64(text);
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12)));
  }

  // Password -> { auth (sent, base64), kek (kept, CryptoKey) }.
  async function fromPassword(password, salt) {
    const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: ITERATIONS }, base, 512));
    return { auth: b64(bits.slice(0, 32)), kek: await aes(bits.slice(32)) };
  }

  return {
    b64, unb64, rand,
    newSalt: () => b64(rand(16)),
    newKey: () => b64(rand(32)), // a data key or a backup key, as base64
    fromPassword,
    // Seal / open a key (base64) with another key: a CryptoKey, or raw base64.
    wrapKey: async (keyB64, withKey) => seal(typeof withKey === 'string' ? await aes(unb64(withKey)) : withKey, unb64(keyB64)),
    unwrapKey: async (sealed, withKey) => b64(await open(typeof withKey === 'string' ? await aes(unb64(withKey)) : withKey, sealed)),
    dataKey: (keyB64) => aes(unb64(keyB64)),
    sealJson: async (key, obj) => seal(key, enc.encode(JSON.stringify(obj))),
    openJson: async (key, text) => JSON.parse(dec.decode(await open(key, text))),
  };
})();
if (typeof module !== 'undefined') module.exports = Crypt;
