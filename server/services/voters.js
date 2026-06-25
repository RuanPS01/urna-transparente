import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { sha256hex } from '../blockchain/crypto.js';

/**
 * Registro de eleitores (o "cadastro eleitoral" fora da corrente).
 * Vincula um título de eleitor a UMA carteira (chave pública), garantindo
 * elegibilidade: só carteiras registradas podem votar e cada título tem
 * uma única carteira. Guardamos o HASH do título — nunca o título em si.
 */
function load() {
  try {
    if (fs.existsSync(config.votersFile)) {
      return JSON.parse(fs.readFileSync(config.votersFile, 'utf8'));
    }
  } catch {
    /* arquivo ausente/corrompido → registro vazio */
  }
  return { byTitulo: {}, byKey: {} };
}

function save(db) {
  fs.mkdirSync(path.dirname(config.votersFile), { recursive: true });
  fs.writeFileSync(config.votersFile, JSON.stringify(db, null, 2));
}

function fail(message, status) {
  return Object.assign(new Error(message), { status });
}

/** Endereço curto e legível derivado da chave pública (como um wallet). */
export function addressOf(publicKeyB64) {
  return sha256hex(publicKeyB64).slice(0, 16);
}

export function register({ titulo, publicKey }) {
  if (!titulo || !publicKey) throw fail('Título e chave pública são obrigatórios.', 400);

  const db = load();
  const th = sha256hex(String(titulo).trim());

  const donoDoTitulo = db.byTitulo[th];
  if (donoDoTitulo && donoDoTitulo !== publicKey) {
    throw fail('Este título de eleitor já possui uma identidade registrada.', 409);
  }
  const donoDaChave = db.byKey[publicKey];
  if (donoDaChave && donoDaChave !== th) {
    throw fail('Esta chave já está vinculada a outro título.', 409);
  }

  db.byTitulo[th] = publicKey;
  db.byKey[publicKey] = th;
  save(db);

  return { address: addressOf(publicKey), registeredAt: Date.now() };
}

export function isRegistered(publicKey) {
  return !!load().byKey[publicKey];
}

export function voterCount() {
  return Object.keys(load().byKey).length;
}
