import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { fetchCandidatesFromTSE } from './tse.js';

let seedCache = null;

function loadSeed() {
  if (!seedCache) {
    seedCache = JSON.parse(fs.readFileSync(config.seedFile, 'utf8'));
  }
  return seedCache;
}

function cacheFile(uf, cargo) {
  return path.join(config.cacheDir, `cand_${config.tse.year}_${uf}_${cargo}.json`);
}

function readCache(uf, cargo) {
  try {
    const f = cacheFile(uf, cargo);
    if (fs.existsSync(f)) {
      const snap = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Date.now() - snap.fetchedAt < config.tse.cacheTtlMs) return snap.candidatos;
    }
  } catch {
    /* cache corrompido é ignorado */
  }
  return null;
}

function writeCache(uf, cargo, candidatos) {
  try {
    fs.mkdirSync(config.cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile(uf, cargo), JSON.stringify({ fetchedAt: Date.now(), candidatos }, null, 2));
  } catch {
    /* falha de cache não é fatal */
  }
}

/**
 * Retorna candidatos para um cargo/UF, na ordem de preferência:
 *   1. cache local válido
 *   2. API do TSE (e grava no cache)
 *   3. dados-semente (fallback offline)
 */
export async function getCandidates({ uf, cargo }) {
  const cached = readCache(uf, cargo);
  if (cached) return { source: 'cache', candidatos: cached };

  if (config.tse.enabled) {
    try {
      const candidatos = await fetchCandidatesFromTSE({ uf, cargo });
      if (candidatos.length) {
        writeCache(uf, cargo, candidatos);
        return { source: 'tse', candidatos };
      }
    } catch (e) {
      console.warn(`[TSE] indisponível para ${uf}/${cargo} — usando dados-semente. (${e.message})`);
    }
  }

  const seed = loadSeed();
  const candidatos = seed[`${uf}_${cargo}`] || seed[cargo] || [];
  return { source: 'seed', candidatos };
}
