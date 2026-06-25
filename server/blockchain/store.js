import fs from 'node:fs';
import path from 'node:path';
import { Blockchain } from './Blockchain.js';

/** Carrega a corrente do disco ou cria uma nova com o bloco gênese. */
export function loadChain(file, difficulty) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return new Blockchain({ difficulty: data.difficulty ?? difficulty, blocks: data.chain });
    }
  } catch (e) {
    console.error('[chain] Falha ao carregar; iniciando nova corrente:', e.message);
  }
  return new Blockchain({ difficulty });
}

/** Persiste a corrente no disco (gravação atômica). */
export function saveChain(file, chain) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(chain.toJSON(), null, 2));
  fs.renameSync(tmp, file);
}
