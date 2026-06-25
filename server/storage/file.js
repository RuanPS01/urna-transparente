import fs from 'node:fs';
import path from 'node:path';
import { loadChain as loadChainFromFile, saveChain } from '../blockchain/store.js';
import { sha256hex, addressOf } from '../blockchain/crypto.js';

const fail = (m, s) => Object.assign(new Error(m), { status: s });

/**
 * Persistência em arquivos JSON — usada localmente e nos testes.
 * Mantém o comportamento original da aplicação.
 */
export function createFileStorage(config) {
  let chainRef = null;

  const loadVoters = () => {
    try {
      if (fs.existsSync(config.votersFile)) return JSON.parse(fs.readFileSync(config.votersFile, 'utf8'));
    } catch { /* vazio */ }
    return { byTitulo: {}, byKey: {} };
  };
  const saveVoters = (db) => {
    fs.mkdirSync(path.dirname(config.votersFile), { recursive: true });
    fs.writeFileSync(config.votersFile, JSON.stringify(db, null, 2));
  };

  return {
    kind: 'file',

    async init() {
      fs.mkdirSync(config.dataDir, { recursive: true });
    },

    async loadChain(difficulty) {
      chainRef = loadChainFromFile(config.chainFile, difficulty);
      saveChain(config.chainFile, chainRef); // garante o gênese em disco
      return chainRef;
    },

    async appendBlock() {
      saveChain(config.chainFile, chainRef);
    },

    async registerVoter(titulo, publicKey) {
      if (!titulo || !publicKey) throw fail('Título e chave pública são obrigatórios.', 400);
      const db = loadVoters();
      const th = sha256hex(String(titulo).trim());
      if (db.byTitulo[th] && db.byTitulo[th] !== publicKey) throw fail('Este título de eleitor já possui uma identidade registrada.', 409);
      if (db.byKey[publicKey] && db.byKey[publicKey] !== th) throw fail('Esta chave já está vinculada a outro título.', 409);
      db.byTitulo[th] = publicKey;
      db.byKey[publicKey] = th;
      saveVoters(db);
      return { address: addressOf(publicKey), registeredAt: Date.now() };
    },

    async isRegistered(publicKey) {
      return !!loadVoters().byKey[publicKey];
    },

    async voterCount() {
      return Object.keys(loadVoters().byKey).length;
    },
  };
}
