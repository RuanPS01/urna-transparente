// Carteira do eleitor: par de chaves ECDSA P-256 gerado e guardado no
// navegador (localStorage). A chave privada NUNCA sai do dispositivo -
// ela apenas assina o voto localmente, como numa carteira de criptomoeda.

const LS_KEY = 'urna_wallet_v1';
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

export async function sha256hex(str) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function addressOf(publicKeyB64) {
  return (await sha256hex(publicKeyB64)).slice(0, 16);
}

// Deve casar EXATAMENTE com server/blockchain/crypto.js
export async function computeNullifier(publicKeyB64, round, cargo) {
  return sha256hex(`${publicKeyB64}:${round}:${cargo}`);
}

export function getWallet() {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearWallet() {
  localStorage.removeItem(LS_KEY);
}

export async function createWallet(titulo) {
  const kp = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify']);
  const spki = await crypto.subtle.exportKey('spki', kp.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const wallet = {
    titulo,
    publicKey: bufToB64(spki),
    privateKey: bufToB64(pkcs8),
    createdAt: Date.now(),
  };
  wallet.address = await addressOf(wallet.publicKey);
  localStorage.setItem(LS_KEY, JSON.stringify(wallet));
  return wallet;
}

// Assina um texto e devolve a assinatura em base64 (formato bruto r||s,
// IEEE P-1363 - o mesmo que o servidor Node verifica).
export async function signPayload(privateKeyB64, payload) {
  const key = await crypto.subtle.importKey('pkcs8', b64ToBuf(privateKeyB64), ALGO, false, ['sign']);
  const sig = await crypto.subtle.sign(SIGN, key, new TextEncoder().encode(payload));
  return bufToB64(sig);
}
